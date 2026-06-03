using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Web;
using System.Web.Mvc;

namespace lxxl.Models
{
    public class T_Form
    {
        [Key]
        [HiddenInput(DisplayValue = false)]
        public long ID { get; set; }

        [Display(Name = "逻辑Id")]
        [StringLength(32)]
        public string gId { get; set; }

        [Display(Name = "表单名称")]
        public string Name { get; set; }

        [Display(Name = "表单说明")]
        public string Info { get; set; }

        [Display(Name = "创建时间")]
        public DateTime CreateTime { get; set; }

        [Display(Name = "是否删除")]
        public bool IsDelete { get; set; }

        [Display(Name = "备注")]
        public string Remark { get; set; }
        public ICollection<T_Item> Item { get; set; }
        public T_Form()
        {
            this.gId = Guid.NewGuid().ToString("N");
            this.CreateTime = DateTime.Now;
            this.IsDelete = false;
        }

        public T_Form(string name, string info)
        {
            this.gId = Guid.NewGuid().ToString("N");
            this.CreateTime = DateTime.Now;
            this.IsDelete = false;
            this.Name = name;
            this.Info = info;
        }

    }
}