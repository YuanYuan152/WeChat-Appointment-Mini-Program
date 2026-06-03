using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace lxxl.Models
{
    public class T_Examiner
    {
        [Key]
        [HiddenInput(DisplayValue = false)]
        public long ID { get; set; }
        
        [Display(Name = "咨询师轮播")]
        public bool IsBanner { get; set; }

        [Display(Name = "名称")]
        public string Name { get; set; }

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

        [Display(Name = "所教课程")]
        public string Course { get; set; }

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

        public T_Examiner()
        {
            this.IsBanner = false;
            this.CreateTime = DateTime.Now;
            this.ModifyTime = DateTime.Now;
            this.IsDelete = false;
            this.number = 1;
        }

        public T_Examiner(string name, string course, string url = "", string profile = "", string contentmain = "", bool IsBanner = false, bool istop = true)
        {
            this.IsBanner = IsBanner;
            this.CreateTime = DateTime.Now;
            this.ModifyTime = DateTime.Now;
            this.IsDelete = false;
            this.Name = name;
            this.Course = course;
            this.url = url;
            this.Profile = profile;
            this.ContentMain = contentmain;
            this.IsTop = istop;
            this.number = 1;
        }
    }
}