import sys 
import json
import time
import requests
import validators
from urllib.request import Request, urlopen
import urllib
from bs4 import BeautifulSoup
import jieba
import jieba.analyse
import os

url = sys.argv[1]

#finish the code here


tags_dic = set()

script_dir = os.path.dirname(__file__) #<-- absolute dir the script is in
tags_path = "tags.txt"
temp_path = "temp.txt"
TWdict_path = "TWdict.txt"
temp_abs_path = os.path.join(script_dir, temp_path)
tags_abs_path = os.path.join(script_dir, tags_path)
TWdict_abs_path = os.path.join(script_dir, TWdict_path)
jieba.set_dictionary(TWdict_abs_path)


with open(tags_abs_path, 'r') as tags:
    for tag in tags.readlines():
      if tag not in tags_dic:
        tags_dic.add(tag)

temp = open(temp_abs_path, 'a')
temp.truncate()

requests.adapters.DEFAULT_RETRIES = 5 # 增加重连次数
s = requests.session()
s.keep_alive = False # 关闭多余连接
s.get(url)
re = requests.get(url)
re.encoding = 'utf-8' #需要新增這一行，告知html檔案解碼方式
soup = BeautifulSoup(re.text, 'html.parser')
url_txt = soup.text
tag = jieba.analyse.extract_tags(url_txt, topK=40)
tags_added = set()
for i in tag:
    if i not in tags_dic and i not in tags_added:
        temp.write(i+'\n')
        tags_added.add(i)
print(url +"已加入")

temp.close()


#expected results
# result = {
#   'title': 'title of ' + url,
#   'keywords': tags_need
# }

# json = json.dumps(result)

# print(str(json))
# sys.stdout.flush()


