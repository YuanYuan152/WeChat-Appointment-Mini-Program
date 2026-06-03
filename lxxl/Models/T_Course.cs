using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace lxxl.Models
{
    public class T_Course
    {
        [Key]
        [HiddenInput(DisplayValue = false)]
        public long ID { get; set; }
        
        [Display(Name = "是否轮播")]
        public bool IsBanner { get; set; }

        [Display(Name = "名称")]
        public string Name { get; set; }

        [Display(Name = "所属ID")]//一级为0
        public int CourseID { get; set; }

        [Display(Name = "类型")]
        public short Type { get; set; }

        [Display(Name = "图片路径")]
        public string url { get; set; }

        [Display(Name = "图片路径")]
        public string url2 { get; set; }

        [Display(Name = "导语")]
        public string Profile { get; set; }

        [Display(Name = "内容")]
        public string ContentMain { get; set; }

        [Display(Name = "置顶")]
        public bool IsTop { get; set; }
        
        [Display(Name = "顺序号")]
        public int number { get; set; }
        
        [Display(Name = "是否删除")]
        public bool IsDelete { get; set; }

        [Display(Name = "创建时间")]
        public DateTime CreateTime { get; set; }

        [Display(Name = "修改时间")]
        public DateTime ModifyTime { get; set; }

        [Display(Name = "备用字段")]
        public string Backup { get; set; }

        [Display(Name = "备注")]
        public string Remark { get; set; }

        public T_Course()
        {
            this.IsBanner = false;
            this.CreateTime = DateTime.Now;
            this.ModifyTime = DateTime.Now;
            this.IsDelete = false;
            this.number = 1;
            this.Type = 1;
            this.CourseID = 0;
        }

        public T_Course(string name, string profile, bool IsBanner = false, string contentmain = "", bool istop = true, string url = "")
        {
            this.IsBanner = IsBanner;
            this.CreateTime = DateTime.Now;
            this.ModifyTime = DateTime.Now;
            this.IsDelete = false;
            this.Name = name;
            this.url = url;
            this.Profile = profile;
            this.ContentMain = contentmain;
            this.IsTop = istop;
            this.number = 1;
            this.Type = 1;
            this.CourseID = 0;
        }
    }
}