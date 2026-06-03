using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations.Schema;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Web;
using System.Web.Mvc;

namespace lxxl.Models
{
    //医院数据表
    public class T_Hospital
    {
        [Key]
        [HiddenInput(DisplayValue = false)]
        public long id { get; set; }

        [Required]
        [Display(Name = "医院名称")]
        [StringLength(100)]
        public string name { get; set; }

        [Display(Name = "医院地址")]
        [StringLength(100)]
        public string adress { get; set; }

        [Display(Name = "医院简介")]
        public string profiles { get; set; }

        [Display(Name = "医院电话")]
        public string tel { get; set; }

        [Display(Name = "医院类型")]
        [StringLength(20)]
        public string type { get; set; }

        [Display(Name = "等级")]
        [StringLength(20)]
        public string grade { get; set; }

        [Display(Name = "特色科室")]
        public string special { get; set; }
        [StringLength(100)]

        [Display(Name = "所有科室")]
        public ICollection<T_HospitalDepartment> hospitalDepartment { get; set; }

        [Display(Name = "是否删除")]
        public bool isDelete { get; set; }

        [Display(Name = "添加时间")]
        public DateTime createTime { get; set; }

        [Display(Name = "备注")]
        public string remark { get; set; }

        public T_Hospital()
        {
            this.createTime = DateTime.Now;
            this.isDelete = false;
        }
        public T_Hospital(string name)
        {
            this.createTime = DateTime.Now;
            this.isDelete = false;
            this.name = name;
        }

        public T_Hospital(string name, string adress, string grade, string special, string tel)
        {
            this.createTime = DateTime.Now;
            this.isDelete = false;
            this.name = name;
            this.adress = adress;
            this.grade = grade;
            this.special = special;
            this.tel = tel;
        }
    }
}