using Aliyun.Acs.Core;
using Aliyun.Acs.Core.Exceptions;
using Aliyun.Acs.Core.Profile;
using Aliyun.Acs.Dysmsapi.Model.V20170525;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Dynamic;
using System.IO;
using System.Linq;
using System.Net.Mail;
using System.Text.RegularExpressions;
using System.Web;

namespace lxxl.Service
{
    public class SendMsg
    {
        #region 发送邮件
        /// <summary>
        /// SendMail(string fromAddress, string toAddress, string smtp, string frompwd)
        /// </summary>
        /// <param name="fromAddress">发送者邮箱</param>
        /// <param name="toAddress">接收者邮箱</param>
        /// <param name="smtp">主机</param>
        /// <param name="frompwd">发送者邮箱密码</param>
        public static bool SendMail(string fromAddress, string toAddress, string smtp, string frompwd, string body, string subject, string fileName = "")
        {
            try
            {
                Regex reg = new Regex(@"\w+([-+.']\w+)*@\w+([-.]\w+)*\.\w+([-.]\w+)*");

                if (!reg.IsMatch(toAddress))
                {
                    string text = "The address is not in the form of email";
                    return false;
                }//Email地址形式上就不对  

                string mailServer = getMailServer(toAddress, true);

                if (mailServer == null)
                {
                    string text = "The mail server does not exist！";
                    return false;
                    //邮件服务器探测错误  
                }

                SmtpClient client = new SmtpClient();

                MailMessage message = new MailMessage();

                // 设置发信人的EMAIL地址
                message.From = new MailAddress(fromAddress);

                // 设置收信人的EMAIL地址
                message.To.Add(toAddress);
                // 设置回复的EMAIL地址
                message.ReplyTo = new MailAddress(fromAddress);

                // 设置抄送的EMAIL地址
                // message.CC.Add(ccAddress);
                // message.Bcc.Add(bccAddress);

                // 设置发信主题及内容
                message.Subject = subject;
                message.Body = "<div style='Color:red'>" + body + "</div>";
                if (!string.IsNullOrEmpty(fileName))
                {
                    Attachment data = new Attachment(fileName);
                    message.Attachments.Add(data);
                    message.Attachments.Add(data);
                }
                message.IsBodyHtml = true;
                // 设置SMTP host及端口
                client.Host = smtp;
                client.Port = 25;
                client.UseDefaultCredentials = false;
                System.Net.NetworkCredential basicAuthenticationInfo = new System.Net.NetworkCredential(fromAddress, frompwd);
                client.Credentials = basicAuthenticationInfo;
                client.EnableSsl = true;
                client.Send(message);

                return true;
            }
            catch (Exception ex)
            {
                Log.Error("SendMail:", toAddress + ex.ToString());
                return false;
            }
        }
        #endregion

        #region 发送邮件
        /// <summary>
        /// SendMail(string fromAddress, string toAddress, string smtp, string frompwd)
        /// </summary>
        /// <param name="fromAddress">发送者邮箱</param>
        /// <param name="toAddress">接收者邮箱</param>
        /// <param name="smtp">主机</param>
        /// <param name="frompwd">发送者邮箱密码</param>
        public static bool SendMailtest2(string fromAddress, string toAddress, string smtp, string frompwd, string body, string subject, int post = 587, bool EnableSsl = true, string fileName = "")
        {
            try
            {
                Regex reg = new Regex(@"\w+([-+.']\w+)*@\w+([-.]\w+)*\.\w+([-.]\w+)*");

                if (!reg.IsMatch(toAddress))
                {
                    string text = "The address is not in the form of email";
                    return false;
                }//Email地址形式上就不对  

                string mailServer = getMailServer(toAddress, true);

                if (mailServer == null)
                {
                    string text = "The mail server does not exist！";
                    return false;
                    //邮件服务器探测错误  
                }

                SmtpClient client = new SmtpClient();

                MailMessage message = new MailMessage();

                // 设置发信人的EMAIL地址
                message.From = new MailAddress(fromAddress);

                // 设置收信人的EMAIL地址
                message.To.Add(toAddress);
                // 设置回复的EMAIL地址
                message.ReplyTo = new MailAddress(fromAddress);

                // 设置抄送的EMAIL地址
                // message.CC.Add(ccAddress);
                // message.Bcc.Add(bccAddress);

                // 设置发信主题及内容
                message.Subject = subject;
                message.Body = body;
                if (!string.IsNullOrEmpty(fileName))
                {
                    Attachment data = new Attachment(fileName);
                    message.Attachments.Add(data);
                }
                message.IsBodyHtml = true;
                // 设置SMTP host及端口
                client.Host = smtp;
                client.EnableSsl = EnableSsl;
                client.UseDefaultCredentials = false;
                client.Port = post;
                System.Net.NetworkCredential basicAuthenticationInfo = new System.Net.NetworkCredential(fromAddress, frompwd);
                client.Credentials = basicAuthenticationInfo;
                client.DeliveryMethod = SmtpDeliveryMethod.Network;
                client.Send(message);

                return true;
            }
            catch (Exception ex)
            {
                Log.Error("SendMail:", toAddress + ex.ToString());
                return false;
            }
        }
        #endregion

        #region 发送邮件
        /// <summary>
        /// SendMail(string fromAddress, string toAddress, string smtp, string frompwd)
        /// </summary>
        /// <param name="fromAddress">发送者邮箱</param>
        /// <param name="toAddress">接收者邮箱</param>
        /// <param name="smtp">主机</param>
        /// <param name="frompwd">发送者邮箱密码</param>
        public static bool SendMailtest222(string fromAddress, string toAddress, string smtp, string frompwd, string body, string subject, int post = 587, bool EnableSsl = true, string fileName = "")
        {
            try
            {
                Regex reg = new Regex(@"\w+([-+.']\w+)*@\w+([-.]\w+)*\.\w+([-.]\w+)*");

                if (!reg.IsMatch(toAddress))
                {
                    string text = "The address is not in the form of email";
                    return false;
                }//Email地址形式上就不对  

                string mailServer = getMailServer(toAddress, true);

                if (mailServer == null)
                {
                    string text = "The mail server does not exist！";
                    return false;
                    //邮件服务器探测错误  
                }

                SmtpClient client = new SmtpClient();

                MailMessage message = new MailMessage();

                // 设置发信人的EMAIL地址
                message.From = new MailAddress(fromAddress);

                // 设置收信人的EMAIL地址
                message.To.Add(toAddress);
                // 设置回复的EMAIL地址
                message.ReplyTo = new MailAddress(fromAddress);

                // 设置抄送的EMAIL地址
                // message.CC.Add(ccAddress);
                // message.Bcc.Add(bccAddress);

                // 设置发信主题及内容
                message.Subject = subject;
                message.Body = body;
                if (!string.IsNullOrEmpty(fileName))
                {
                    Attachment data = new Attachment(fileName);
                    message.Attachments.Add(data);
                }
                message.IsBodyHtml = true;
                // 设置SMTP host及端口
                client.Host = smtp;
                client.Port = post;
                client.UseDefaultCredentials = false;
                System.Net.NetworkCredential basicAuthenticationInfo = new System.Net.NetworkCredential(fromAddress, frompwd);
                client.Credentials = basicAuthenticationInfo;
                client.EnableSsl = EnableSsl;
                client.Send(message);

                return true;
            }
            catch (Exception ex)
            {
                Log.Error("SendMail:", toAddress + ex.ToString());
                return false;
            }
        }
        #endregion

        


        #region 发送邮件
        /// <summary>
        /// SendMail(string fromAddress, string toAddress, string smtp, string frompwd)
        /// </summary>
        /// <param name="fromAddress">发送者邮箱</param>
        /// <param name="toAddress">接收者邮箱</param>
        /// <param name="smtp">主机</param>
        /// <param name="frompwd">发送者邮箱密码</param>
        public static bool SendMailLst(string fromAddress, string toAddress, string smtp, string frompwd, string body, string subject, string fileName = "")
        {
            try
            {
                Regex reg = new Regex(@"\w+([-+.']\w+)*@\w+([-.]\w+)*\.\w+([-.]\w+)*");

                if (!reg.IsMatch(toAddress))
                {
                    string text = "The address is not in the form of email";
                    return false;
                }//Email地址形式上就不对  

                string mailServer = getMailServer(toAddress, true);

                if (mailServer == null)
                {
                    string text = "The mail server does not exist！";
                    return false;
                    //邮件服务器探测错误  
                }

                SmtpClient client = new SmtpClient();

                MailMessage message = new MailMessage();

                // 设置发信人的EMAIL地址
                message.From = new MailAddress(fromAddress);

                // 设置收信人的EMAIL地址
                message.To.Add(toAddress);
                // 设置回复的EMAIL地址
                message.ReplyTo = new MailAddress(fromAddress);

                // 设置抄送的EMAIL地址
                // message.CC.Add(ccAddress);
                // message.Bcc.Add(bccAddress);

                // 设置发信主题及内容
                message.Subject = subject;
                message.Body = "<div style='Color:red'>" + body + "</div>";
                //if (!string.IsNullOrEmpty(fileName))
                //{
                //    Attachment data = new Attachment(fileName);
                //    message.Attachments.Add(data);
                //    message.Attachments.Add(data);
                //}
                string path0 = System.Web.HttpContext.Current.Server.MapPath("~/UploadPdf");
                string[] name = fileName.Split(',');
                foreach (string temp in name)
                {
                    string path = path0 + "/" + temp + ".pdf";
                    if (!string.IsNullOrEmpty(path))
                    {
                        Attachment data = new Attachment(path);
                        message.Attachments.Add(data);
                    }
                }
                message.IsBodyHtml = true;
                // 设置SMTP host及端口
                client.Host = smtp;
                client.Port = 25;
                client.UseDefaultCredentials = false;
                System.Net.NetworkCredential basicAuthenticationInfo = new System.Net.NetworkCredential(fromAddress, frompwd);
                client.Credentials = basicAuthenticationInfo;
                client.EnableSsl = true;
                client.Send(message);

                return true;
            }
            catch (Exception ex)
            { return false; }
        }
        #endregion

        public static string getMailServer(string strEmail, bool IsCheck)
        {
            string strDomain = strEmail.Split('@')[1];
            string text = "分离出邮箱域名: ";
            if (IsCheck == true)
                text += strDomain;
            ProcessStartInfo info = new ProcessStartInfo();   //指定启动进程时使用的一组值。  
            info.UseShellExecute = false;
            info.RedirectStandardInput = true;
            info.RedirectStandardOutput = true;
            info.FileName = "nslookup";
            info.CreateNoWindow = true;
            info.Arguments = "-type=mx " + strDomain;
            Process ns = Process.Start(info);        //提供对本地和远程进程的访问并使您能够启动和停止本地系统进程。  
            StreamReader sout = ns.StandardOutput;

            Regex reg = new Regex(@"mail exchanger = (?<mailServer>[^\s]+)");
            string strResponse = "";
            while ((strResponse = sout.ReadLine()) != null)
            {

                Match amatch = reg.Match(strResponse);   // Match  表示单个正则表达式匹配的结果。  

                if (reg.Match(strResponse).Success)
                {
                    return amatch.Groups["mailServer"].Value;   //获取由正则表达式匹配的组的集合  

                }
            }
            return null;
        }
    }
}