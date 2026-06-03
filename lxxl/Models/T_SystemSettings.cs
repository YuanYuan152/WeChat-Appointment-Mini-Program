using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Web.Mvc;

namespace lxxl.Models
{
    //系统设置表
    public class T_SystemSettings
    {
        [Key]
        [HiddenInput(DisplayValue = false)]
        public long id { get; set; }

        [Required]
        [Display(Name = "类型")]
        public int type { get; set; }
        
        [Display(Name = "说明")]
        public string content1 { get; set; }

         [Display(Name = "数量")]
        public int? number { get; set; }

        [Display(Name = "创建时间")]
        public DateTime createTime { get; set; }
        
        [Display(Name = "是否删除")]
        public bool isDelete { get; set; }

        [Display(Name = "备注")]
        public string remark { get; set; }


        [Display(Name = "备注2")]
        public string remark2 { get; set; }

        
        public T_SystemSettings()
        {
            this.isDelete = false;
            this.createTime = DateTime.Now;
        }

        public T_SystemSettings(int type, string content1, int number)
        {
            this.type = type;
            this.content1 = content1;
            this.number = number;
            this.isDelete = false;
            this.createTime = DateTime.Now;
        }

    }
}
