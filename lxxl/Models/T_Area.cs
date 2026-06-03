using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Web.Mvc;

namespace lxxl.Models
{
    //地区数据表
    public class T_Area
    {
        [Key]
        [HiddenInput(DisplayValue = false)]
        public long ID { get; set; }

        [Display(Name = "级别")]//地区分三级，1.省、2.市、3.县
        public short Grade { get; set; }

        [Display(Name = "所属地区")]//省级则为0，市、县则为其上级ID
        public long ToArea { get; set; }

        [Required]
        [Display(Name = "地区名")]
        public string Name { get; set; }

        [Display(Name = "是否删除")]
        public bool IsDelete { get; set; }

        [Display(Name = "添加时间")]
        public DateTime CreateTime { get; set; }

        [Display(Name = "备注")]
        public string Remark { get; set; }

        public T_Area()
        {
            this.CreateTime = DateTime.Now;
            this.IsDelete = false;
        }

        public T_Area(short grade, long toarea, string name)
        {
            this.CreateTime = DateTime.Now;
            this.IsDelete = false;
            this.Grade = grade;
            this.ToArea = toarea;
            this.Name = name;
        }

        public T_Area GetArea()
        {
            if (Grade != 1)
            {
                TMLSContext db = new TMLSContext();
                return db.T_Area.Where(o => o.ID == this.ToArea).FirstOrDefault();
            }
            return null;
        }
    }
}
