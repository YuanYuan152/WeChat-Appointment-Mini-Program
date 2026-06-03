using Aliyun.Acs.Core;
using Aliyun.Acs.Core.Exceptions;
using Aliyun.Acs.Core.Profile;
using Aliyun.Acs.Dysmsapi.Model.V20170525;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;

namespace lxxl.Service
{

    public class AliMsg
    {
        private static string product = "Dysmsapi";//短信API产品名称
        private static string domain = "dysmsapi.aliyuncs.com";//短信API产品域名
        private static string accessId = System.Configuration.ConfigurationManager.AppSettings["AliyunSmsAccessKeyId"];
        private static string accessSecret = System.Configuration.ConfigurationManager.AppSettings["AliyunSmsAccessKeySecret"];
        private static string regionIdForPop = "cn-hangzhou";
        /// <summary>
        /// 发送验证码
        /// </summary>
        /// <param name="tel">手机号</param>
        /// <param name="Parameter">短信参数</param>
        /// <param name="modal_i">验证码类别</param>
        /// <returns>是否发送成功</returns>
        public static bool sendShortMsg(string tel, dynamic Parameter, int modal_i)
        {
            //return true;
            string[] modal = { "SMS_271460307", "SMS_271495336" };
            IClientProfile profile = DefaultProfile.GetProfile(regionIdForPop, accessId, accessSecret);
            DefaultProfile.AddEndpoint(regionIdForPop, regionIdForPop, product, domain);
            IAcsClient acsClient = new DefaultAcsClient(profile);
            SendSmsRequest request = new SendSmsRequest();
            try
            {
                request.PhoneNumbers = tel;
                request.SignName = "上海连心心理咨询";
                request.TemplateCode = modal[modal_i];
                request.TemplateParam = JsonConvert.SerializeObject(Parameter);
                //request.OutId = "xxxxxxxx";
                //请求失败这里会抛ClientException异常
                SendSmsResponse sendSmsResponse = acsClient.GetAcsResponse(request);
                System.Console.WriteLine(sendSmsResponse.Message);
                LogWriter.Default.WriteInfo("ServerException=>短信发送成功" + tel + sendSmsResponse.Message);
                return true;
            }
            catch (ServerException e)
            {
                LogWriter.Default.WriteWarning("ServerException=>短信发送错误" + tel + ":" + e.Message);
                return false;
            }
            catch (ClientException e)
            {
                LogWriter.Default.WriteWarning("ClientException=>短信发送错误" + tel + ":" + e.Message);
                return false;
            }
        }
    }
}