using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace lxxl.Models
{
    public class T_Field
    {
        [Key]
        [HiddenInput(DisplayValue = false)]
        public long ID { get; set; }

        [Display(Name = "名称")]
        public string Name { get; set; }

        [Display(Name = "所属ID")]//一级为0
        public long FieldID { get; set; }

        [Display(Name = "类型")]
        public short Type { get; set; }        
        
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

        public T_Field()
        {
            this.CreateTime = DateTime.Now;
            this.ModifyTime = DateTime.Now;
            this.IsDelete = false;
            this.number = 1;
            this.Type = 1;
            this.FieldID = 0;
        }

        public T_Field(string name, string profile, long FieldID = 0, int number = 1)
        {
            this.CreateTime = DateTime.Now;
            this.ModifyTime = DateTime.Now;
            this.IsDelete = false;
            this.Name = name;
            this.Type = 1;
            this.number = number;
            this.FieldID = FieldID;
        }
    }
}