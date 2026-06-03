using System;
using System.Collections.Generic;
using System.Dynamic;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using lxxl.Models;

namespace lxxl
{
    public class LogFilterAttribute : ActionFilterAttribute
    {
        //该方法会在action方法执行之前调用  
        public override void OnActionExecuting(ActionExecutingContext filterContext)
        {
            //filterContext.HttpContext.Response.Write("我是OnActionExecuting，我在action方法调用钱执行<br/>");
            //LogResponseInfo(filterContext);
            base.OnActionExecuting(filterContext);
        }

        //该方法会在action方法执行之后调用  
        public override void OnActionExecuted(ActionExecutedContext filterContext)
        {
            //filterContext.HttpContext.Response.Write("我是OnActionExecuted，我在action方法调用后执行<br/>");
            base.OnActionExecuted(filterContext);
        }
        //在action方法返回结果之后执行  
        public override void OnResultExecuting(ResultExecutingContext filterContext)
        {
            //filterContext.HttpContext.Response.Write("我是OnActionExecuting，我action方法返回结果之前执行<br/>");
            base.OnResultExecuting(filterContext);
        }

        //在action方法返回结果之前前执行  
        public override void OnResultExecuted(ResultExecutedContext filterContext)
        {
            //filterContext.HttpContext.Response.Write("我是OnResultExecuted，我在action方法返回结果之后执行<br/>");
            //new Thread(() => { }).Start();
            LogResponseInfo(filterContext);
            base.OnResultExecuted(filterContext);
        }

        public void LogResponseInfo(ControllerContext filterContext)
        {
            //Thread.Sleep(10000);
            HttpRequestBase Request = filterContext.RequestContext.HttpContext.Request;
            HttpResponseBase Response = filterContext.RequestContext.HttpContext.Response;
            dynamic Info = new ExpandoObject();

            Info.Ip = Request.UserHostAddress;
            Info.Port = Request.Url.Port.ToString();
            Info.Host = Request.Url.Authority;
            Info.HttpMethod = Request.HttpMethod;
            Info.Agent = Request.UserAgent;
            Info.Url = Request.Url.AbsoluteUri;
            Info.Headers = Request.Headers;
            Info.Params = Request.Params;
            Info.Form = Request.Form;

            Info.StatusCode = Response.StatusCode;
            Info.controller = filterContext.RouteData.Values["controller"];
            Info.action = filterContext.RouteData.Values["action"];
            TMLSContext db = new TMLSContext();
            T_Admin admin = filterContext.HttpContext.Session["admin"] as T_Admin;
            if (admin != null)
            {
                //db.T_Log.Add(new T_Log(admin.ID, Convert.ToString(Info.Ip), Convert.ToString(Info.Url), Convert.ToString(Info.Port), Convert.ToString(Info.Host), Convert.ToString(Info.controller), Convert.ToString(Info.action), Convert.ToString(Info.HttpMethod), Convert.ToString(Info.Params), Convert.ToString(Info.Form), Convert.ToString(Info.StatusCode)));
                //db.SaveChanges();
            }
        }
    }
}