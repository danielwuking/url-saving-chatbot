const {
  router,
  text
} = require('bottender/router');
const {
  PythonShell
} = require('python-shell')
const mysql = require('mysql');
const fs = require('fs');
const sd = require('silly-datetime');
let con = mysql.createConnection({
  host: process.env.HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DATABASE
});
con.connect();
let time = sd.format(new Date(), 'YYYY-MM-DD HH:mm:ss');

async function SayHi(context) {
  await context.sendText('Hi!');
}

async function ParseUrl(context) {
  let query = context.event.text;
  context.setState({
    url: query.substr(query.indexOf('：') + 1 || query.indexOf(':') + 1),
    onSave: true,
  });
  await context.sendText(`你想要存的網址是：${context.state.url}？ 請回答「是」或「否」`);
}

async function ConfirmUrl(context) {
  if (context.state.onSave && (context.event.text === '是' || context.event.text === 'y' || context.event.text === 'Y')) {
    await SaveUrl(context);
  } else {
    context.setState({
      onSave: false,
    });
    await context.sendText(`請重新輸入指令`);
  }
}

function getUuid() {
  var d = Date.now();
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    d += performance.now(); //use high-precision timer if available
  }
  return 'yxxxx'.replace(/[xy]/g, function (c) {
    var r = (d + Math.random() * 16) % 16 | 0;
    d = Math.floor(d / 16);
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

async function SaveUrl(context) {
  if (context.state.url.search("https://") == -1)
    urlToSave = "https://" + context.state.url;
  else
    urlToSave = context.state.url;
  const options = {
    args: [
      urlToSave,
    ],
    mode: 'text',
  }
  const crawlUrlByPython = async () => {
    console.log('running python file...');
    PythonShell.run(__dirname + '/main.py', options, (err, data) => {
      console.log('python finished')
      const saveDataToDB = async () => {
        console.log('start to save to db')

        //[todo] get user information
        let name = context.session.id;

        //[todo] save data to database
        await con.query(`SELECT url FROM urls WHERE userId = "${name}"`, async function (err, result) {
            if (err) throw err;
            if (result.length != 0) {
              for (i = 0; i < result.length; i++) {
                if (result[i].url == urlToSave) {
                  context.sendText(`此網址已存在`);
                  context.setState({
                    url: '',
                    onSave: false,
                  });
                  console.log("state已初始化")
                  return
                }
              };
            }
            fs.readFile(__dirname + '/temp.txt', function (error, data) {
              // 若錯誤 error 為一個物件，則會在這邊觸發內部程式碼，作為簡單的錯誤處理
              if (error) {
                console.log('讀取檔案失敗')
                return
              }
              var lines = data.toString()
              var NewArray = new Array();
              var NewArray = lines.split("\n");
              var uuid = getUuid();
              for (i = 0; i < NewArray.length; i++) {
                let sql = `INSERT INTO urls (userId, url, tag, insertTime, uuid) VALUES ('${name}', '${urlToSave}', '${NewArray[i]}', '${time}', '${uuid}')`;
                // console.log(NewArray[i])
                con.query(sql, function (err) {
                  if (err) throw err;
                });
              }
              console.log("record inserted");
              fs.writeFile(__dirname + '/temp.txt', '', async function () {
                await context.sendText(`代號${uuid}`+"\n"+`${urlToSave}`+"\n"+`已儲存完畢`);
                await context.setState({
                  url: '',
                  onSave: false,
                });
                await console.log("state已初始化")
              });
            })
          })
      }
      saveDataToDB();
      //if (err) 
      // console.log(data);
      // const crawlingResults = JSON.parse(data);
    })
  }
  crawlUrlByPython();
}


async function SearchUrl(context) {
  let query = context.event.text;
  context.setState({
    keyword: query.includes(':') ? query.split(':')[1] : query.split('：')[1]
  });
  await SearchUrlinDB(context);
}

async function SearchUrlinDB(context) {

  await con.query(`SELECT url, uuid FROM urls WHERE tag = "${context.state.keyword}" and userId = "${context.session.id}"`, function (err, result) {
      if (err) throw err;
      // console.log(result)
      // let urlResults = JSON.parse(result);
      // console.log(urlResult)
      var count = 0;
      if (result.length == 0) {
        context.sendText(`沒有關於${context.state.keyword}的結果`)
        context.setState({
          keyword: '',
        });
      } else {
        var text = `關於 ${context.state.keyword} 的結果如下：` + "\n"
        for (i = 0; i < result.length; i++) {
          text += '[' + result[i].uuid + ']' + result[i].url + "\n"
          count++;
        }
        text += `總共找到 ${count} 個結果`;
        context.sendText(`${text}`);
        setTimeout(function () {
          context.setState({
            keyword: '',
          });
          console.log("state已初始化")
        }, 300);
      }
    });

};

async function deleteUrl(context) {
    let query = context.event.text;
    let uuid = query.substr(query.indexOf('：') + 1 || query.indexOf(':') + 1)
    let name = context.session.id;
    con.query(`SELECT url FROM urls WHERE userId = "${name}" AND uuid = "${uuid}" `, async function (err, result) {
      if (result.length == 0) {
        context.sendText(`代號${uuid}不存在`);
        return
      } else {
        context.setState({
          url: result.url,
        });
      }
    })
    var urlToDelete = context.state.url
    con.query(`DELETE FROM urls WHERE userId = "${name}" AND uuid = "${uuid}" `, async function (err, result) {
      if (err) throw err;
      context.sendText(`[${uuid}]${urlToDelete}已刪除`);
      context.setState({
        url: '',
      });
    })
}

function addTag(context) {
    let query = context.event.text;
    var uuid = query.substr(0, 5)
    let name = context.session.id;    
    var tagToAdd = query.substr(query.indexOf('：') + 1 || query.indexOf(':') + 1)
    con.query(`SELECT url FROM urls WHERE userId = "${name}" AND uuid = "${uuid}" `, function (err, result) {
      if (result.length == 0) {
        context.sendText(`沒有代號${uuid}的網址`);
        return
      } else {
        context.setState({
          url: result.url,
        });
      }
    })
    var url = context.state.url
    con.query(`INSERT INTO urls (userId, url, tag, insertTime, uuid) VALUES ('${name}', '${url}', '${tagToAdd}', '${time}', '${uuid}')`, async function (err, result) {
      if (err) throw err;
      context.sendText(`標籤「${tagToAdd}」已加入[${uuid}]${url}`);
      context.setState({
        url: ''
      });
    })
}

module.exports = async function App() {
  return router([
    text(/(存|save|Save)(:|：),*/, ParseUrl),
    text(/(查|找|查詢|s|S)(:|：),*/, SearchUrl),
    text(/(加|add|Add)(:|：),*/, addTag),
    text(/(刪|刪除|delete|Delete)(:|：),*/, deleteUrl),
    text(/(是|否|y|Y|n|N)/, ConfirmUrl),
    text(/hi|Hi|hello|Hello/, SayHi),
  ]);
};

module.exports.initialState = {
  url: '',
  keyword: '',
  onSave: false,
};