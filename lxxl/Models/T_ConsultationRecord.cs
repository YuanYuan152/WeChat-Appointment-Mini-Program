using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace lxxl.Models
{
    public class T_ConsultationRecord
    {
        [Key]
        [HiddenInput(DisplayValue = false)]
        public long ID { get; set; }
        
        [Required]
        [Display(Name = "类型")]
        public int Type { get; set; }

        [Display(Name = "患者")]
        public long UserID { get; set; }

        [Display(Name = "患者ID")]//外键关联患者
        [ForeignKey("UserID")]
        public T_User User { get; set; }

        public long doctorID { get; set; }

        [Display(Name = "医生ID")]//外键关联医生
        [ForeignKey("doctorID")]
        public T_Doctor doctor { get; set; }

        [Required]
        [Display(Name = "姓名")]
        public string name { get; set; }
        
        [Display(Name = "地区")]
        public string bazaar { get; set; }

        [Display(Name = "年级")]
        public string record { get; set; }

        [Display(Name = "手机号")]
        public string mobile { get; set; }

        [Display(Name = "项目")]
        public string nation { get; set; }

        [Display(Name = "是否已处理")]
        public bool IsTop { get; set; }

        [Display(Name = "咨询次数")]
        public int Frequency { get; set; }

        [Display(Name = "咨询ID")]
        public string ConsultationIDs { get; set; }
        
        [Display(Name = "显示")]
        public bool IsShow { get; set; }

        [Display(Name = "是否删除")]
        public bool IsDelete { get; set; }

        [Display(Name = "创建时间")]
        public DateTime CreateTime { get; set; }

        [Display(Name = "修改时间")]
        public DateTime ModifyTime { get; set; }

        [Display(Name = "签约时间")]
        public string TimeXY { get; set; }

        [Display(Name = "结案时间")]
        public string TimeJA { get; set; }

        [Display(Name = "备用字段1")]
        public string Backup1 { get; set; }

        [Display(Name = "备注")]
        public string Remark { get; set; }

        [Display(Name = "备用1")]
        public string Remark1 { get; set; }

        [Display(Name = "备用2")]
        public string Remark2 { get; set; }

        public T_ConsultationRecord()
        {
            this.Type = 1;
            this.CreateTime = DateTime.Now;
            this.ModifyTime = DateTime.Now;
            this.IsTop = false;
            this.IsShow = false;
            this.IsDelete = false;
            this.Frequency = 0;
        }

        public T_ConsultationRecord(int type, string name, string bazaar, string record, string mobile, string nation)
        {
            this.Type = type;
            this.CreateTime = DateTime.Now;
            this.ModifyTime = DateTime.Now;
            this.IsShow = false;
            this.IsDelete = false;
            this.IsTop = false;
            this.name = name;
            this.bazaar = bazaar;
            this.record = record;
            this.mobile = mobile;
            this.nation = nation;
            this.Frequency = 0;
        }
    }
}