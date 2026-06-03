using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace lxxl.Models
{
    public class T_MessageRecord
    {
        [Key]
        [HiddenInput(DisplayValue = false)]
        public long ID { get; set; }
        
        [Required]
        [Display(Name = "类型")]//1、推送信息，2、提醒信息
        public int Type { get; set; }
        
        [Required]
        [Display(Name = "类型")]//1、管理员，2、助理、3、咨询师，4、患者
        public int UserType { get; set; }

        [Display(Name = "用户ID")]
        public long UserID { get; set; }

        [Display(Name = "关联用户ID")]
        public long AssociatedUserID { get; set; }

        [Display(Name = "内容")]
        public string MSG { get; set; }

        [Display(Name = "姓名")]
        public string name { get; set; }

        [Display(Name = "手机号")]
        public string mobile { get; set; }

        [Display(Name = "状态")] //0、未处理，1已查阅，2、已处理
        public int Status { get; set; }

        [Display(Name = "次数")]
        public int Frequency { get; set; }
        
        [Display(Name = "显示")]
        public bool IsShow { get; set; }

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

        [Display(Name = "备用")]
        public string Remark2 { get; set; }

        public T_MessageRecord()
        {
            this.Type = 1;
            this.CreateTime = DateTime.Now;
            this.ModifyTime = DateTime.Now;
            this.UserType = 3;
            this.UserID = 0;
            this.AssociatedUserID = 0;
            this.Status = 0;
            this.IsShow = false;
            this.IsDelete = false;
            this.Frequency = 0;
        }

        public T_MessageRecord(int type, int userType, long userID, string msg)
        {
            this.Type = type;
            this.CreateTime = DateTime.Now;
            this.ModifyTime = DateTime.Now;
            this.IsShow = false;
            this.IsDelete = false;
            this.MSG = msg;
            this.UserType = userType;
            this.UserID = userID;
            this.AssociatedUserID = 0;
            this.Status = 0;
            this.Frequency = 0;
        }
    }
}