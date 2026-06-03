using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;

namespace lxxl.Service
{
    /// <summary>
    /// 服务控制器，一些服务变量及方法可在此处设置成全局静态
    /// </summary>
    public class Service
    {
        public static DateTime editmenutime = DateTime.Now;//最后修改菜单时间

        public static void SetEditMenuTime() 
        {
            editmenutime = DateTime.Now;
        }
    }
}