using Senparc.Weixin.MP.CommonAPIs;
using Senparc.Weixin.MP.Containers;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;

namespace lxxl
{
    public static class Config
    {
        public static string version = "build";/*版本，正式版build，开发版dev*/
        public static string domain = "https://www.ji-psy.com";//主站地址
        /*公众号配置*/
        public static string txl_AppId = "wx7c7c6f068de77af8";
        public static string txl_AppSecret = "0c72c960c4470fd9aadb7b7fae2acffb";
        public static string txl_MchId = "1603667556";
        public static string txl_Key = "TJjxl200211Voyager7c6f068de77af8";
        public static string txl_token { set { } get { return AccessTokenContainer.GetAccessToken(Config.txl_AppId); } }
        public static string txl_ticket { set { } get { return CommonApi.GetTicketByAccessToken(Config.txl_AppId).ticket; } }


    }
}