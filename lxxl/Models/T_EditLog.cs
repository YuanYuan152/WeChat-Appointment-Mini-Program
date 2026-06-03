using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Web;
using System.Web.Mvc;

namespace lxxl.Models
{

    public class T_EditLog
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

        [Display(Name = "区域")]
        public string area { get; set; }
        
        [Display(Name = "控制器")]
        [StringLength(32)]
        public string controller { get; set; }       

        [Display(Name = "方法名")]
        [StringLength(32)]
        public string action { get; set; }

        [Display(Name = "修改内容")]
        public string content { get; set; }

        [Display(Name = "原来内容")]
        [StringLength(32)]
        public string contentOld { get; set; }

        [Display(Name = "表")]
        public string form { get; set; }

        [Display(Name = "字段")]
        public string field { get; set; }

        [Display(Name = "状态")]
        public string statusCode { get; set; }
                
        [Display(Name = "删除")]
        public bool isDelete { get; set; }

        [Display(Name = "添加时间")]
        public DateTime createTime { get; set; }

        [Display(Name = "备注")]
        public string remark { get; set; }

        public T_EditLog()
        {
            this.isDelete = false;
            this.createTime = DateTime.Now;
        }
        public T_EditLog(short getType, long adminid, string ip, string url, string area, string controller, string action, string method, string content, string contentOld, string form, string field)
        {
            this.getType = getType;
            this.adminId = adminid;
            this.isDelete = false;
            this.createTime = DateTime.Now;
            this.ip = ip;
            this.url = url;
            this.area = area;
            this.controller = controller;
            this.action = action;
            this.content = content;
            this.contentOld = contentOld;
            this.field = field;
            this.form = form;
            this.isDelete = false;
            this.createTime = DateTime.Now;
        }
    }
}