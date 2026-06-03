using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text;
using System.Web.Mvc;

namespace lxxl.Models
{
    //邮箱设置表
    public class T_EmailSettings
    {
        [Key]
        [HiddenInput(DisplayValue = false)]
        public long id { get; set; }
        
        [Required]
        [Display(Name = "主机")]
        [StringLength(32)]
        public string smtp { get; set; }

        [Required]
        [Display(Name = "邮箱地址")]
        [StringLength(32)]
        public string fromAddress { get; set; }        
        
        [Required]
        [Display(Name = "邮箱密码")]
        [StringLength(32)]
        public string frompwd { get; set; }

        [Display(Name = "端口")]
        public int port { get; set; }

        [Display(Name = "启用SSL")]
        public bool isSSL { get; set; }

        public long adminID { get; set; }

        [Display(Name = "管理员ID")]//外键关联管理员
        [ForeignKey("adminID")]
        public T_Admin admin { get; set; }
                
        [Display(Name = "创建时间")]
        public DateTime createTime { get; set; }
        
        [Display(Name = "是否删除")]
        public bool isDelete { get; set; }

        [Display(Name = "备注")]
        public string remark { get; set; }

        
        public T_EmailSettings()
        {
            this.isDelete = false;
            this.createTime = DateTime.Now;
            this.port = 587;
            this.isSSL = true;
        }

        public T_EmailSettings(long adminID, string smtp, string fromAddress, string frompwd, int port = 587, bool isSSL = true)
        {
            this.adminID = adminID;
            this.smtp = smtp;
            this.fromAddress = fromAddress;
            this.frompwd = frompwd;
            this.isDelete = false;
            this.createTime = DateTime.Now;
            this.port = port;
            this.isSSL = isSSL;
        }

    }
}
