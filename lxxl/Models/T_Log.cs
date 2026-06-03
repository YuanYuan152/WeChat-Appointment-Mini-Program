using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Web;
using System.Web.Mvc;

namespace lxxl.Models
{

    public class T_Log
    {
        [Key]
        [HiddenInput(DisplayValue = false)]
        public long id { get; set; }

        [Display(Name = "类型")]
        public short getType { get; set; }

        [Display(Name = "AdminId")]
        public long adminId { get; set; }

        [Display(Name = "URL")]
        public string url { get; set; }

        [Display(Name = "Ip")]
        [StringLength(20)]
        public string ip { get; set; }

        [Display(Name = "端口")]
        public int port { get; set; }

        [Display(Name = "主机")]
        [StringLength(100)]
        public string host { get; set; }

        [Display(Name = "区域")]
        public string area { get; set; }

        [Display(Name = "控制器")]
        [StringLength(32)]
        public string controller { get; set; }       

        [Display(Name = "方法名")]
        [StringLength(32)]
        public string action { get; set; }

        [Display(Name = "请求头")]
        public string headers { get; set; }

        [Display(Name = "请求方式")]
        [StringLength(32)]
        public string method { get; set; }

        [Display(Name = "请求参数")]
        public string getParams { get; set; }

        [Display(Name = "Body")]
        public string form { get; set; }

        [Display(Name = "代理")]
        public string agent { get; set; }

        [Display(Name = "状态")]
        public string statusCode { get; set; }

        [Display(Name = "时长")]
        public long getTime { get; set; }
        
        [Display(Name = "删除")]
        public bool isDelete { get; set; }

        [Display(Name = "添加时间")]
        public DateTime createTime { get; set; }

        [Display(Name = "备注")]
        public string remark { get; set; }

        public T_Log()
        {
            this.isDelete = false;
            this.createTime = DateTime.Now;
        }
        public T_Log(short getType, long adminid, string ip, string url, int port, string host, string area, string controller, string action, string method, string headers, string parameter, string form, string agent, string status_code)
        {
            this.getType = getType;
            this.adminId = adminid;
            this.isDelete = false;
            this.createTime = DateTime.Now;
            this.ip = ip;
            this.url = url;
            this.port = port;
            this.host = host;
            this.area = area;
            this.controller = controller;
            this.action = action;
            this.headers = headers;
            this.method = method;
            this.getParams = parameter;
            this.form = form;
            this.agent = agent;
            this.statusCode = status_code;
        }
    }
}