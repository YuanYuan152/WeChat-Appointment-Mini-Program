using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace lxxl.Models
{
    public class T_InfoData
    {
        [Key]
        [HiddenInput(DisplayValue = false)]
        public long ID { get; set; }
        
        [Required]
        [Display(Name = "文章类型")]//目前只有类型1.文章
        public int Type { get; set; }

        [Required]
        [Display(Name = "标题")]
        public string Title { get; set; }

        [Display(Name = "来源")]
        public string Source { get; set; }

        [Display(Name = "导语")]
        public string Profile { get; set; }

        [Display(Name = "内容")]
        public string ContentMain { get; set; }

        [Display(Name = "图片路径")]
        public string url { get; set; }

        [Display(Name = "置顶")]
        public bool IsTop { get; set; }
        
        [Display(Name = "显示")]
        public bool IsShow { get; set; }

        [Display(Name = "是否删除")]
        public bool IsDelete { get; set; }

        [Display(Name = "创建时间")]
        public DateTime CreateTime { get; set; }

        [Display(Name = "修改时间")]
        public DateTime ModifyTime { get; set; }

        [Display(Name = "用户gId")]
        [StringLength(32)]
        public string usergId { get; set; }

        [Display(Name = "下载次数")]
        public int Views { get; set; }

        [Display(Name = "备用字段")]
        public string Backup { get; set; }

        [Display(Name = "备注")]
        public string Remark { get; set; }

        public T_InfoData()
        {
            this.Type = 1;
            this.CreateTime = DateTime.Now;
            this.ModifyTime = DateTime.Now;
            this.IsShow = false;
            this.IsDelete = false;
            this.IsTop = false;
            this.Views = 0;
            this.usergId = "";
        }

        public T_InfoData(int Type, string title, string source, string profile, string url, bool IsShow)
        {
            this.Type = Type;
            this.CreateTime = DateTime.Now;
            this.ModifyTime = DateTime.Now;
            this.IsShow = IsShow;
            this.IsTop = false;
            this.IsDelete = false;
            this.Views = 0;
            this.Title = title;
            this.Source = source;
            this.Profile = profile;
            this.url = url;
            this.usergId = "";
        }
    }
}