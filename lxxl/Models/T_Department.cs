using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Web;
using System.Web.Mvc;

namespace lxxl.Models
{
    //科室数据表
    public class T_Department
    {
        [Key]
        [HiddenInput(DisplayValue = false)]
        public long id { get; set; }

        [Display(Name = "级别")]//科室分两级
        public short grade { get; set; }

        [Display(Name = "所属科室")]//一级为0，二级为其所属一级ID
        public long toDepartmentID { get; set; }

        [Required]
        [Display(Name = "科室名称")]
        [StringLength(100)]
        public string name { get; set; }

        [Display(Name = "是否删除")]
        public bool isDelete { get; set; }

        [Display(Name = "添加时间")]
        public DateTime createTime { get; set; }

        [Display(Name = "备注")]
        public string remark { get; set; }
        
        public T_Department()
        {
            this.createTime = DateTime.Now;
            this.isDelete = false;
        }
        public T_Department(short grade, long todepartmentid, string name, long SourceID = 0)
        {
            this.createTime = DateTime.Now;
            this.isDelete = false;
            this.grade = grade;
            this.toDepartmentID = todepartmentid;
            this.name = name;
        }

        /// <summary>
        /// 获取该科室下面的科室
        /// </summary>
        /// <returns></returns>
        public List<T_Department> GetDepartmentList()
        {
            TMLSContext db = new TMLSContext();
            List<T_Department> DepartmentList = db.T_Department.Where(o => o.toDepartmentID == this.id).ToList();
            return DepartmentList;
        }
        /// <summary>
        /// 获取上级科室
        /// </summary>
        /// <returns></returns>
        public T_Department GetDepartment()
        {
            if (grade != 1)
            {
                TMLSContext db = new TMLSContext();
                return db.T_Department.Where(o => o.id == this.toDepartmentID).FirstOrDefault();
            }
            return null;
        }
    }
}