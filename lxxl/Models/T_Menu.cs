using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using System.ComponentModel.DataAnnotations;

namespace lxxl.Models
{
    public class T_Menu
    {
        [Key]
        [HiddenInput(DisplayValue = false)]
        public long ID { get; set; }

        [Required]
        [Display(Name = "菜单名称")]
        public string MenuName { get; set; }

        [Display(Name = "菜单所属ID")]//一级菜单为0
        public int MenuID { get; set; }

        [Display(Name = "是否显示")]
        public Boolean Show { get; set; }

        [Display(Name = "排序")]
        public int OrderTag { get; set; }

        [Display(Name = "类型")]//1.列表2.直接跳转至首文章3.跳转链接
        public short Type { get; set; }

        [Display(Name = "链接")]
        public string URL { get; set; }

        [Display(Name = "删除")]
        public bool IsDelete { get; set; }

        [Display(Name = "添加时间")]
        public DateTime CreateTime { get; set; }

        [Display(Name = "备注")]
        public string Remark { get; set; }

        public T_Menu()
        {
            this.MenuID = 0;
            this.Show = false;
            this.IsDelete = false;
            this.CreateTime = DateTime.Now;
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="menuname">菜单名称</param>
        /// <param name="menuid">一级菜单id，若为一级菜单，则id为0</param>
        /// <param name="type">菜单类型1.列表2.直接跳转至首文章3.跳转链接</param>
        /// <param name="ordertag">排序号</param>
        /// <param name="show">是否显示，显示为true</param>
        /// <param name="url">跳转链接</param>
        public T_Menu(string menuname,int menuid, short type,int ordertag,bool show=false,string url=null)
        {
            this.MenuName = menuname;
            this.MenuID = menuid;
            this.Show = show;
            this.IsDelete = false;
            this.CreateTime = DateTime.Now;
            this.Type = type;
            this.OrderTag = ordertag;
            this.URL = url;
        }
    }
}