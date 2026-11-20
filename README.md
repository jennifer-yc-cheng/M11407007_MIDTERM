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

> 也可以不在本機編譯，直接使用已上傳到 Docker Hub 的最新版 image（[yearafter](https://hub.docker.com/u/yearafter)，各版本請見 [系統手冊](MANUAL.md#發布-image-到-docker-hub)）：
> 把上面最後一行換成
> ```bash
> sudo docker compose pull
> sudo docker compose up -d
> ```

### 4. 開啟網站

在 Ubuntu 的 Firefox 開啟 <http://localhost>，就會看到分店列表。

系統第一次啟動時，會自動為 6 間分店產生過去 14 天的示範訂單，所以後台一打開就有營收資料。

## 登入帳號

| 角色 | 帳號 | 密碼 |
|---|---|---|
| 總部老闆 | `admin` | `admin123` |
| 分店店長 | `taipei-manager`（其他分店：`taoyuan`、`zhongli`、`bade`、`taichung`、`tainan` 加上 `-manager`） | `manager123` |

## 更多說明

系統架構、各角色的操作方式、Kiosk 自助點餐、新增分店與常用指令，請見 [系統手冊](MANUAL.md)。

## 情境操作

### 情境一：顧客點餐（不需要登入）

1. 開啟 <http://localhost>，選擇「台北信義店」
2. 菜單上有全品牌共用的**經典飲品**；店長上架特色飲品後（見情境二），這裡也會出現**本店特色飲品**
3. 選擇飲品的甜度、冰塊後按「加入」，再按「送出訂單」
4. 畫面顯示訂單編號，點餐完成

> 店內的自助點餐機（Kiosk）可以開啟 <http://localhost/taipei/kiosk>，用觸控大按鈕點餐。

### 情境二：分店店長新增飲料、查看訂單

1. 按右上角「管理登入」，輸入 `taipei-manager` / `manager123`
2. 系統自動進入**台北信義店後台**，可以看到今日營收、近 7 日營收圖，以及「最近訂單」（情境一的訂單也在裡面）
3. 在「本店特色飲品」按「＋ 新增特色飲品」，輸入品名、價格並選擇照片，按「新增」
4. 回到 <http://localhost/taipei>，新飲品出現在本店特色飲品中；打開其他分店（例如 <http://localhost/tainan>）則看不到，因為這是台北店自己研發的品項
5. 店長只能管理自己的分店：開啟 <http://localhost/tainan/admin> 會被導回台北店後台

### 情境三：連鎖飲料店老闆查看營收

1. 登出後，用 `admin` / `admin123` 登入
2. 進入**總部後台**，可以看到：
   - 全品牌今日營收與累計營收
   - 每間分店的今日營收、累計營收、訂單數與在線狀態
   - 各分店營收比較、全品牌近 7 日營收、熱銷品項
   - 依分店篩選的最新訂單
3. 在「經典飲品」修改某款飲品的價格，再打開任一分店的菜單，**所有分店都已套用新價格**
