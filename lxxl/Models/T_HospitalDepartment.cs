using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Web;
using System.Web.Mvc;

namespace lxxl.Models
{
    //医院科室
    public class T_HospitalDepartment
    {
        [Key]
        [HiddenInput(DisplayValue = false)]
        public long id { get; set; }

        [Display(Name = "所属医院")]//外键关联医院
        [ForeignKey("hospitalID")]
        public T_Hospital hospital { get; set; }
        public long hospitalID { get; set; }

        [Display(Name = "科室")]//外键关联科室
        [ForeignKey("departmentID")]
        public T_Department department { get; set; }
        public long departmentID { get; set; }

        [Display(Name = "描述")]
        public string describe { get; set; }

        [Display(Name = "是否删除")]
        public bool isDelete { get; set; }

        [Display(Name = "添加时间")]
        public DateTime createTime { get; set; }

        [Display(Name = "备注")]
        public string remark { get; set; }

        [Display(Name = "排序")]
        public int sort { get; set; }

        public T_HospitalDepartment()
        {
            this.createTime = DateTime.Now;
            this.isDelete = false;
        }
        public T_HospitalDepartment(long hospitalid, long departmentid)
        {
            this.createTime = DateTime.Now;
            this.isDelete = false;
            this.hospitalID = hospitalid;
            this.departmentID = departmentid;
        }
    }
}