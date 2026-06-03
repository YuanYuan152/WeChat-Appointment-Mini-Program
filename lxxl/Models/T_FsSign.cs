using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Web;
using System.Web.Mvc;

namespace lxxl.Models
{
    public class T_FsSign
    {
        [Key]
        [HiddenInput(DisplayValue = false)]
        public long ID { get; set; }

        [Display(Name = "签到医生Id")]
        public long DoctorId { get; set; }

        [Display(Name = "地址")]
        public string Adress { get; set; }

        [Display(Name = "经度")]
        public string Longitude { get; set; }

        [Display(Name = "纬度")]
        public string latitude { get; set; }

        [Display(Name = "删除")]
        public bool isDelete { get; set; }

        [Display(Name = "时间")]
        public DateTime createTime { get; set; }

        [Display(Name = "备注")]
        public string Remark { get; set; }

        public T_FsSign()
        {
            this.isDelete = false;
            this.createTime = DateTime.Now;
        }

    }
}