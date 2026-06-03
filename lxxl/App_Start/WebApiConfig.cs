using System;
using System.Collections.Generic;
using System.Linq;
using System.Web.Http;

namespace lxxl
{
    public static class WebApiConfig
    {
        public static void Register(HttpConfiguration config)
        {
            // 添加支持action的路由
            config.Routes.MapHttpRoute(
                name: "ApiWithAction",
                routeTemplate: "api/{controller}/{action}/{id}",
                defaults: new { id = RouteParameter.Optional }
            );
            
            // 保留原有的路由
            config.Routes.MapHttpRoute(
                name: "DefaultApi",
                routeTemplate: "api/{controller}/{id}",
                defaults: new { id = RouteParameter.Optional }
            );
        }
    }
}
