using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;

namespace lxxl.Service
{
    public class myhelper
    {
        public static bool CheckAgent()
        {
            bool flag = false;

            string agent = HttpContext.Current.Request.UserAgent;
            string[] keywords = { "Android", "iPhone", "iPod", "iPad", "Windows Phone", "MQQBrowser", "micromessenger" };

            //排除 Windows 桌面系统
            if (!agent.Contains("Windows NT") || (agent.Contains("Windows NT") && agent.Contains("compatible; MSIE 9.0;")))
            {
                //排除 苹果桌面系统
                if (!agent.Contains("Windows NT") && !agent.Contains("Macintosh"))
                {
                    foreach (string item in keywords)
                    {
                        if (agent.Contains(item))
                        {
                            flag = true;
                            break;
                        }
                    }
                }
            }

            return flag;
        }
    }
}