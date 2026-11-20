# 開心茶飲 Happy Tea — 連鎖飲料店分散式平台

總部與各分店共用同一套網站與經典菜單，每間分店有獨立的服務與資料庫，可以上架自己的特色飲品。老闆可以看到全部分店的營收，店長可以看到自己分店的經營資訊。

## 部署步驟

### 1. 開啟 VM

用 VMware 開啟老師提供的 **Ubuntu22GUI**，登入後按 `Ctrl + Alt + T` 打開 Terminal。

### 2. 安裝 Docker 與 Git

把下面整段貼進 Terminal 執行：

```bash
# Add Docker's official GPG key:
sudo apt-get update
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# Add the repository to Apt sources:
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update

sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Install SSH & Git
sudo apt install openssh-server git -y
```

### 3. 下載專案並啟動

```bash
git clone https://github.com/jennifer-yc-cheng/M11407007_MIDTERM.git
cd M11407007_MIDTERM
sudo docker compose up -d --build
```

第一次啟動約需 3～5 分鐘。

> 也可以不在本機編譯，直接使用已上傳到 Docker Hub 的 image（[yearafter](https://hub.docker.com/u/yearafter)）：
> 把上面最後一行換成
> ```bash
> sudo docker compose pull
> sudo docker compose up -d
> ```

### 4. 開啟網站

在 Ubuntu 的 Firefox 開啟 <http://localhost>，就會看到分店列表。

## 登入帳號

| 角色 | 帳號 | 密碼 |
|---|---|---|
| 總部老闆 | `admin` | `admin123` |
| 分店店長 | `taipei-manager`（其他分店：`taoyuan`、`zhongli`、`bade`、`taichung`、`tainan` 加上 `-manager`） | `manager123` |

## 更多說明

系統架構、各角色的操作方式、Kiosk 自助點餐、新增分店與常用指令，請見 [系統手冊](MANUAL.md)。
