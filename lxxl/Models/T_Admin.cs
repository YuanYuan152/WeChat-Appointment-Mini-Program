using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Globalization;
using System.Web.Mvc;
using System.Web.Security;

namespace lxxl.Models
{
    public class T_Admin
    {
        [Key]
        [HiddenInput(DisplayValue = false)]
        public long ID { get; set; }

        [Required]
        [Display(Name = "用户名")]
        public string UserName { get; set; }

        [Required]
        [Display(Name = "密码")]
        [DataType(DataType.Password)]
        [StringLength(100, ErrorMessage = "密码最小为6位.", MinimumLength = 6)]
        public string Password { get; set; }

        [Required]
        [Display(Name = "管理员类型")]//1.暂定只有超级管理员
        public short Type { get; set; }

        [Required]
        [Display(Name = "姓名")]
        public string Name { get; set; }

        [Display(Name = "电话")]
        public string Tel { get; set; }

        [Display(Name = "邮箱")]
        public string Mail { get; set; }

        [Display(Name = "是否删除")]
        public bool IsDelete { get; set; }

        [Display(Name="创建时间")]
        public DateTime CreateTime { get; set; }

        [Display(Name = "备用字段")]
        public string Backup { get; set; }
        
        [Display(Name = "备注")]
        public string Remark { get; set; }

        public T_Admin()
        {
            this.IsDelete = false;
            this.CreateTime = DateTime.Now;
            this.Type = 1;
        }

        public T_Admin(string username,string password,short type,string name="")
        {
            this.UserName = username;
            this.Password = password;
            this.Name = name;
            this.IsDelete = false;
            this.CreateTime = DateTime.Now;
            this.Type = type;
        }
    }
}