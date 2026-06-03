using Aliyun.Acs.Core;
using Aliyun.Acs.Core.Exceptions;
using Aliyun.Acs.Core.Profile;
using Aliyun.Acs.Dysmsapi.Model.V20170525;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Web;

namespace lxxl.Service
{
    public class Common
    {
        #region 发送验证码
        /// <summary>
        /// 发送验证码
        /// </summary>
        /// <param name="tel">手机号</param>
        /// <param name="Parameter">短信参数</param>
        /// <param name="modal_i">验证码类别</param>
        /// <returns>是否发送成功</returns>
        public static bool sendMsgCode(string tel, SortedDictionary<String, String> Parameter, int modal_i)
        {
            //return false;
            //0：SMS_271460307 注册发送验证码:{code:验证码,product:验证码短信}

            string product = "Dysmsapi";//短信API产品名称（短信产品名固定，无需修改）
            string domain = "dysmsapi.aliyuncs.com";//短信API产品域名（接口地址固定，无需修改）
            string accessKeyId = System.Configuration.ConfigurationManager.AppSettings["AliyunSmsAccessKeyId"];//阿里云短信 AccessKey ID（从 Web.config 读取）
            string accessKeySecret = System.Configuration.ConfigurationManager.AppSettings["AliyunSmsAccessKeySecret"];//阿里云短信 AccessKey Secret（从 Web.config 读取）
            string[] modal = { "SMS_271460307", "" };
            string[] modal1 = { "SMS_271460307", "" };
            IClientProfile profile = DefaultProfile.GetProfile("cn-hangzhou", accessKeyId, accessKeySecret);
            DefaultProfile.AddEndpoint("cn-hangzhou", "cn-hangzhou", product, domain);
            IAcsClient acsClient = new DefaultAcsClient(profile);
            SendSmsRequest request = new SendSmsRequest();

            try
            {
                request.SignName = "上海连心心理咨询";// "管理控制台中配置的短信签名（状态必须是验证通过）";
                string phonereg = @"^(0|86|17951)?(13[0-9]|15[012356789]|166|17[3678]|18[0-9]|14[57])[0-9]{8}$";
                Regex regexphone = new Regex(phonereg);
                request.PhoneNumbers = tel.Trim();// "接收号码，多个号码可以逗号分隔";
                if (regexphone.IsMatch(request.PhoneNumbers))
                {
                    request.TemplateCode = modal[modal_i];// "管理控制台中配置的审核通过的短信模板的模板CODE（状态必须是验证通过）";
                }
                else
                {
                    if (modal_i > modal1.Length - 1)
                        return false;
                    request.TemplateCode = modal1[modal_i];// "管理控制台中配置的审核通过的短信模板的模板CODE（状态必须是验证通过）";
                }
                request.TemplateParam = JsonConvert.SerializeObject(Parameter);
                SendSmsResponse sendSmsResponse = acsClient.GetAcsResponse(request);
                LogWriter.Default.WriteWarning(sendSmsResponse.HttpResponse.Content);
                if (sendSmsResponse.HttpResponse.Status == 200)
                {
                    return true;
                }
                else
                {
                    return false;
                }
            }
            catch (ServerException e)
            {
                LogWriter.Default.WriteWarning(e.Message);
                return false;
            }
            catch (ClientException e)
            {
                LogWriter.Default.WriteWarning(e.Message);
                return false;
            }
        }
        #endregion
    }
}