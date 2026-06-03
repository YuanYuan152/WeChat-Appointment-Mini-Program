using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace lxxl.Models
{
    public class T_Content
    {
        [Key]
        [HiddenInput(DisplayValue = false)]
        public long ID { get; set; }

        [Display(Name = "所属菜单")]
        [ForeignKey("MenuID")]
        public T_Menu Menu { get; set; }
        public long MenuID { get; set; }
        
        [Display(Name = "用户ID")]
        public long userID { get; set; }

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
        
        [Display(Name = "视频路径")]
        public string video { get; set; }

        [Display(Name = "金额")]
        public double Money { get; set; }

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

        [Display(Name = "浏览次数")]
        public int Views { get; set; }

        [Display(Name = "备用字段")]
        public string Backup { get; set; }

        [Display(Name = "备注")]
        public string Remark { get; set; }

        public T_Content()
        {
            this.Type = 1;
            this.CreateTime = DateTime.Now;
            this.ModifyTime = DateTime.Now;
            this.IsShow = false;
            this.IsDelete = false;
            this.Views = 0;
            this.MenuID = 1;
            this.userID = 0;
            this.Money = 0;
            this.video = "";
        }

        public T_Content(int menuid, string title, string source, string profile, string contentmain, bool istop)
        {
            this.Type = 1;
            this.CreateTime = DateTime.Now;
            this.ModifyTime = DateTime.Now;
            this.IsShow = false;
            this.IsDelete = false;
            this.Views = 0;
            this.MenuID = menuid;
            this.Title = title;
            this.Source = source;
            this.Profile = profile;
            this.ContentMain = contentmain;
            this.IsTop = istop;
            this.userID = 0; 
            this.Money = 0;
            this.video = "";
        }
    }
}