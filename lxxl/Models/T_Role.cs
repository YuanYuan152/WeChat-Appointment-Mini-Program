using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Web.Mvc;

namespace lxxl.Models
{
    //权限角色表
    public class T_Role
    {
        [Key]
        [HiddenInput(DisplayValue = false)]
        public long ID { get; set; }

        [Required]
        [Display(Name = "角色名称")]
        [StringLength(32)]
        public string roleName { get; set; }


        [Display(Name = "权限")]
        public string authority { get; set; }

        [Display(Name = "创建时间")]
        public DateTime createTime { get; set; }
        
        [Display(Name = "是否删除")]
        public bool isDelete { get; set; }

        [Display(Name = "备注")]
        public string remark { get; set; }

        
        public T_Role()
        {
            this.isDelete = false;
            this.createTime = DateTime.Now;
        }

        public T_Role(string roleName, string authority)
        {
            this.roleName = roleName;
            this.authority = authority;
            this.isDelete = false;
            this.createTime = DateTime.Now;
        }

    }
}
