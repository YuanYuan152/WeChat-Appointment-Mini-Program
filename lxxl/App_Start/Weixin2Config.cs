using Senparc.Weixin.MP.CommonAPIs;
using Senparc.Weixin.MP.Containers;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using Weixin.SDK.Helpers;

namespace lxxl
{
    public class Weixin2Config
    {
        public static string Token { private set; get; }
        public static string EncodingAESKey { private set; get; }
        public static string AppID { private set; get; }
        public static string AppSecret { private set; get; }
        public static string spbill_create_ip { private set; get; }
        public static string OauthScope { private set; get; }

        public static TokenHelper TokenHelper { private set; get; }
        public static string token { set { } get { return AccessTokenContainer.GetAccessToken(Weixin2Config.AppID); } }
        public static string ticket { set { } get { return CommonApi.GetTicketByAccessToken(Weixin2Config.AppID).ticket; } }

        public static void Register()
        {

            Token = System.Configuration.ConfigurationManager.AppSettings["Token2"];
            EncodingAESKey = System.Configuration.ConfigurationManager.AppSettings["EncodingAESKey2"];
            AppID = System.Configuration.ConfigurationManager.AppSettings["AppID2"];
            AppSecret = System.Configuration.ConfigurationManager.AppSettings["AppSecret2"];
            var openJSSDK = int.Parse(System.Configuration.ConfigurationManager.AppSettings["OpenJSSDK"]) > 0;
            OauthScope = System.Configuration.ConfigurationManager.AppSettings["OauthScope"];
            TokenHelper = new TokenHelper(6000, AppID, AppSecret, openJSSDK);
            TokenHelper.Run();
        }
    }
}