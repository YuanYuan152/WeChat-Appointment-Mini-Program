using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace lxxl.Models
{
    public class T_ExaminerCourse
    {
        [Key]
        [HiddenInput(DisplayValue = false)]
        public long ID { get; set; }

        [Display(Name = "课程")]
        [ForeignKey("CourseID")]
        public T_Course Course { get; set; }
        public long CourseID { get; set; }

        [Display(Name = "咨询师")]
        [ForeignKey("ExaminerID")]
        public T_Examiner Examiner { get; set; }
        public long ExaminerID { get; set; }

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

        public T_ExaminerCourse()
        {
            this.CreateTime = DateTime.Now;
            this.ModifyTime = DateTime.Now;
            this.IsDelete = false;
        }

        public T_ExaminerCourse(int examinerID, int courseID)
        {
            this.CreateTime = DateTime.Now;
            this.ModifyTime = DateTime.Now;
            this.IsDelete = false;
            this.ExaminerID = examinerID;
            this.CourseID = courseID;
        }
    }
}