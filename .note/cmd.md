## 启动程序
celery -A web:celery_app worker
celery -A web:celery2_app worker

python manage.py migrate
python manage.py runserver 0.0.0.0:8000

## 安装bun
https://github.com/aklinker1/bunv#installation

curl -sL https://raw.githubusercontent.com/aklinker1/bunv/main/install.sh | sh

```plaintext
root@d2654ed5eaf3:/webserver/backend# curl -sL https://raw.githubusercontent.com/aklinker1/bunv/main/install.sh | sh
Downloading Bunv...
Bunv has been installed successfully to ~/.bunv/bin
Make sure to add ~/.bunv/bin to your PATH

帮我添加到docker container的环境变量, 直接进入容器操作，不要编写代码
```

跳过脚本安装依赖

```
bun install --ignore-scripts
```

# 提交commit之前
跳过precommit检查，自己保证precommit没有问题
git commit -n

