using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using System.ComponentModel.DataAnnotations;

namespace lxxl.Models
{
    public class T_ItemType
    {
        [Key]
        [HiddenInput(DisplayValue = false)]
        public long ID { get; set; }

        [Display(Name = "逻辑Id")]
        [StringLength(32)]
        public string gId { get; set; }

        [Display(Name="是否单选")]
        public bool IsOne { get; set; }

        [Display(Name = "名称")]
        public string Name { get; set; }

        [Display(Name = "标识")]
        public string Pag { get; set; }

        [Display(Name = "说明")]
        public string Info { get; set; }

        [Display(Name = "是否删除")]
        public bool IsDelete { get; set; }

        [Display(Name = "备注")]
        public string Remark { get; set; }

        public T_ItemType()
        {
            this.gId = Guid.NewGuid().ToString("N");
            this.IsDelete = false;
            this.IsOne = false;
        }

        public T_ItemType(string name,bool isone,string pag)
        {
            this.gId = Guid.NewGuid().ToString("N");
            this.IsDelete = false;
            this.Pag = pag;
            this.Name = name;
            this.IsOne = isone;
        }
    }
}