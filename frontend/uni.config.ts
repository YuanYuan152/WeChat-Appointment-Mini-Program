import { defineConfig } from '@dcloudio/uni-cli-shared'

export default defineConfig({
  pages: [
    {
      path: 'pages/index/index',
      style: {
        navigationBarTitleText: '连心心理'
      }
    },
    {
      path: 'pages/xy/xy1',
      style: {
        navigationBarTitleText: '咨询协议'
      }
    },
    {
      path: 'pages/xy/xy2',
      style: {
        navigationBarTitleText: '咨询协议'
      }
    },
    {
      path: 'pages/consultant/list',
      style: {
        navigationBarTitleText: '咨询师列表'
      }
    },
    {
      path: 'pages/consultant/detail',
      style: {
        navigationBarTitleText: '咨询师详情'
      }
    },
    {
      path: 'pages/user/profile',
      style: {
        navigationBarTitleText: '个人中心'
      }
    }
  ],
  globalStyle: {
    navigationBarTextStyle: 'black',
    navigationBarTitleText: '连心心理',
    navigationBarBackgroundColor: '#F8F8F8',
    backgroundColor: '#F8F8F8'
  },
  tabBar: {
    color: '#7A7E83',
    selectedColor: '#3B82F6',
    backgroundColor: '#ffffff',
    borderStyle: 'black',
    list: [
      {
        pagePath: 'pages/index/index',
        iconPath: 'static/images/home.png',
        selectedIconPath: 'static/images/home-active.png',
        text: '首页'
      },
      {
        pagePath: 'pages/consultant/list',
        iconPath: 'static/images/consultant.png',
        selectedIconPath: 'static/images/consultant-active.png',
        text: '咨询师'
      },
      {
        pagePath: 'pages/user/profile',
        iconPath: 'static/images/user.png',
        selectedIconPath: 'static/images/user-active.png',
        text: '我的'
      }
    ]
  }
}) 