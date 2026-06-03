using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Web;
using System.Web.Mvc;

namespace lxxl.Models
{
    //医生排期设置
    public class T_DoctorClassSchedule
    {
        [Key]
        [HiddenInput(DisplayValue = false)]
        public long ID { get; set; }

        [Display(Name = "逻辑Id")]
        [StringLength(32)]
        public string gId { get; set; }
        
        [Display(Name = "所属医生")]//外键关联医生
        [ForeignKey("doctorID")]
        public T_Doctor doctor { get; set; }
        public long doctorID { get; set; }

        [Display(Name = "开始时间")]
        public DateTime startTime { get; set; }

        [Display(Name = "结束时间")]
        public DateTime endTime { get; set; }

        [Display(Name = "开始时刻")]
        public string startH { get; set; }

        [Display(Name = "结束时刻")]
        public string endH { get; set; }

        [Display(Name = "星期")]
        public string week { get; set; }

        [Display(Name = "最大报名")]
        public int maxSign { get; set; }

        [Display(Name = "已报名人数")]
        public int numSign { get; set; }

        [Display(Name = "报名费用")]
        public double Price { get; set; }

        [Display(Name = "咨询方式")]
        [StringLength(32)]
        public string methods { get; set; }            
        
        [Display(Name = "地点")]
        public string address { get; set; }

        [Display(Name = "逻辑删除")]
        public bool isDelete { get; set; }

        [Display(Name = "时间")]
        public DateTime createTime { get; set; }

        [Display(Name = "备注")]
        public string Remark { get; set; }

        [Display(Name = "备用")]
        public string Remark2 { get; set; }

        public T_DoctorClassSchedule()
        {
            this.gId = Guid.NewGuid().ToString("N");
            this.isDelete = false;
            this.createTime = DateTime.Now;
            this.maxSign = 0;
            this.Price = 0;
            this.numSign = 0;
        }

        public T_DoctorClassSchedule(long doctorID, DateTime startTime, DateTime endTime, string startH, string endH ,string week,int maxSign = 0, double Price = 0, string address = "")
        {
            this.gId = Guid.NewGuid().ToString("N");
            this.isDelete = false;
            this.createTime = DateTime.Now;
            this.doctorID = doctorID;
            this.startTime = startTime;
            this.endTime = endTime;
            this.startH = startH;
            this.endH = endH;
            this.week = week;
            this.maxSign = maxSign;
            this.Price = Price;
            this.address = address;
        }
        public string getWeek()
        {
            string weeks = "星期日";
            switch (this.week)
            {
                case "1":
                    weeks = "星期一";
                    break;
                case "2":
                    weeks = "星期二";
                    break;
                case "3":
                    weeks = "星期三";
                    break;
                case "4":
                    weeks = "星期四";
                    break;
                case "5":
                    weeks = "星期五";
                    break;
                case "6":
                    weeks = "星期六";
                    break;
                default:
                    break;
            }
            return weeks;
        }
    }
}