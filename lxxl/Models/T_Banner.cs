using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace lxxl.Models
{
    public class T_Banner
    {
        [Key]
        [HiddenInput(DisplayValue = false)]
        public long ID { get; set; }

        [Display(Name = "所属菜单")]
        [ForeignKey("MenuID")]
        public T_Menu Menu { get; set; }
        public long MenuID { get; set; }

        [Required]
        [Display(Name = "文章类型")]//目前类型1.同心理，2.济心理，3.咨询师轮播，21...
        public int Type { get; set; }

        [Display(Name = "标题")]
        public string Title { get; set; }

        [Display(Name = "图片路径")]
        public string url { get; set; }

        [Display(Name = "导语")]
        public string Profile { get; set; }

        [Display(Name = "内容")]
        public string ContentMain { get; set; }

        [Display(Name = "置顶")]
        public bool IsTop { get; set; }

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

        public T_Banner()
        {
            this.Type = 1;
            this.CreateTime = DateTime.Now;
            this.ModifyTime = DateTime.Now;
            this.IsDelete = false;
        }

        public T_Banner(int menuid, string title, string source, string profile,int Type = 1,string contentmain = "", bool istop = true)
        {
            this.Type = Type;
            this.CreateTime = DateTime.Now;
            this.ModifyTime = DateTime.Now;
            this.IsDelete = false;
            this.MenuID = menuid;
            this.Title = title;
            this.url = source;
            this.Profile = profile;
            this.ContentMain = contentmain;
            this.IsTop = istop;
        }
    }
}