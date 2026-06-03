using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;

namespace lxxl.Service
{
    public class WeiXinHelper
    {
        static string domain = System.Configuration.ConfigurationManager.AppSettings["Domain"];

        #region 发送模版消息 来访预约消息通知
        /// <summary>
        /// 发送模版消息，来访预约消息通知
        /// </summary>
        /// <param name="openId">关注微信号《FromUserName》</param>
        /// <returns></returns>
        public static string SendMsg1(string openId = "", string thing2 = "", string thing3 = "", string time5 = "", string thing4 = "", string urlP = "")
        {
            string accessToken = WeixinConfig.TokenHelper.GetToken();
            string url = string.Format("https://api.weixin.qq.com/cgi-bin/message/template/send?access_token={0}", accessToken);
            string strPostData = "{ \"touser\":\"" + openId + "\",\"template_id\":\"4EYdrEBakLWIDjXRDrDCfeeQ0GdQO9cIjLxAjMA74ew\",\"url\":\"" + domain + urlP + "\", \"data\":{\"thing2\":{\"value\":\"" + thing2 + "\",\"color\":\"#173177\"},\"thing3\":{\"value\":\"" + thing3 + "\",\"color\":\"#173177\"},\"time5\":{\"value\":\"" + time5 + "\",\"color\":\"#173177\"},\"thing4\":{\"value\":\"" + thing4 + "\",\"color\":\"#173177\"}}}";
            string strJson = Post.HttpPostData(url, strPostData);

            return "";
        }
        #endregion


        #region 发送模版消息 访客预约结果通知
        /// <summary>
        /// 发送模版消息，访客预约结果通知	
        /// </summary>
        /// <param name="openId">关注微信号《FromUserName》</param>
        /// <returns></returns>
        public static string SendMsg2(string openId = "", string thing1 = "", string thing2 = "", string thing3 = "", string time5 = "", string thing4 = "", string remark = "", string urlP = "")
        {
            string first = "测试一下";
            string accessToken = WeixinConfig.TokenHelper.GetToken();
            string url = string.Format("https://api.weixin.qq.com/cgi-bin/message/template/send?access_token={0}", accessToken);
            string strPostData = "{ \"touser\":\"" + openId + "\",\"template_id\":\"7aA8xplf7wWRi6zEgGh_MfH_ouYQ60JV_-pBdMr3PGE\",\"url\":\"" + domain + urlP + "\", \"data\":{\"thing1\":{\"value\":\"" + thing1 + "\",\"color\":\"#173177\"},\"thing2\":{\"value\":\"" + thing2 + "\",\"color\":\"#173177\"},\"thing3\":{\"value\":\"" + thing3 + "\",\"color\":\"#173177\"},\"time5\":{\"value\":\"" + time5 + "\",\"color\":\"#173177\"},\"thing4\":{\"value\":\"" + thing4 + "\",\"color\":\"#173177\"},\"remark\":{\"value\":\"" + remark + "\",\"color\":\"#173177\"}}}";
            string strJson = Post.HttpPostData(url, strPostData);

            return "";
        }
        #endregion

        //#region 发送模版消息 来访预约消息通知
        ///// <summary>
        ///// 发送模版消息，来访预约消息通知
        ///// </summary>
        ///// <param name="openId">关注微信号《FromUserName》</param>
        ///// <returns></returns>
        //public static string SendMsg2(string openId = "", string first = "", string keyword1 = "", string keyword2 = "", string remark = "", string urlP = "")
        //{
        //    string accessToken = WeixinConfig.TokenHelper.GetToken();
        //    string url = string.Format("https://api.weixin.qq.com/cgi-bin/message/template/send?access_token={0}", accessToken);
        //    string strPostData = "{ \"touser\":\"" + openId + "\",\"template_id\":\"7aA8xplf7wWRi6zEgGh_MfH_ouYQ60JV_-pBdMr3PGE\",\"url\":\"" + domain + urlP + "\", \"data\":{\"first\":{\"value\":\"" + first + "\",\"color\":\"#173177\"},\"keyword1\":{\"value\":\"" + keyword1 + "\",\"color\":\"#173177\"},\"keyword2\":{\"value\":\"" + keyword2 + "\",\"color\":\"#173177\"},\"remark\":{\"value\":\"" + remark + "\",\"color\":\"#173177\"}}}";
        //    string strJson = Post.HttpPostData(url, strPostData);

        //    return "";
        //}
        //#endregion
    }
    
}