using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Web;
using System.Web.Mvc;

namespace lxxl.Models
{
    //医生表
    public class T_Doctor
    {
        [Key]
        [HiddenInput(DisplayValue = false)]
        public long ID { get; set; }

        [Display(Name = "逻辑Id")]
        [StringLength(32)]
        public string gId { get; set; }

        [Required]
        [Display(Name = "用户名")]
        public string UserName { get; set; }

        [Required]
        [Display(Name = "密码")]
        [DataType(DataType.Password)]
        [StringLength(100, ErrorMessage = "密码最小为6位.", MinimumLength = 6)]
        public string Password { get; set; }

        [Display(Name = "微信openid")]
        [StringLength(32)]
        public string openid { get; set; }

        [Required]
        [Display(Name = "咨询人姓名")]
        [StringLength(100)]
        public string name { get; set; }

        [Required]
        [Display(Name = "联系方式")]
        [StringLength(20)]
        public string tel { get; set; }

        [Display(Name = "邮箱")]
        [StringLength(100)]
        public string email { get; set; }

        [Display(Name = "所属医院")]//外键关联医院
        [ForeignKey("hospitalID")]
        public T_Hospital hospital { get; set; }
        public long hospitalID { get; set; }

        [Display(Name = "所属科室")]//外键关联科室
        [ForeignKey("departmentID")]
        public T_Department department { get; set; }
        public long departmentID { get; set; }

        [Display(Name = "医院")]
        public string hospitalName { get; set; }

        [Display(Name = "科室")]
        public string departmentName { get; set; }

        [Display(Name = "职称/职务")]
        [StringLength(100)]
        public string position { get; set; }

        [Display(Name = "来源类型")]//0、微信自己  其他管理员id
        public long SourceID { get; set; }
      
        [Display(Name = "性别")]
        [StringLength(10)]
        public string sex { get; set; }

        [Display(Name = "年龄")]
        public int? age { get; set; }

        [Display(Name = "导语")]
        public string Profile { get; set; }

        [Display(Name = "个人介绍")]
        public string introduce { get; set; }
        
        [Display(Name = "头像路径")]
        public string topUrl { get; set; }

        [Display(Name = "图片路径")]
        public string url { get; set; }

        [Display(Name = "图片路径")]
        public string url2 { get; set; }

        [Display(Name = "置顶")]
        public bool IsTop { get; set; }

        [Display(Name = "显示")]
        public bool IsShow { get; set; }

        [Display(Name = "顺序号")]
        public int number { get; set; }

        [Display(Name = "擅长")]
        public string Specialty { get; set; }

        [Display(Name = "职业经历")]
        public string Careerexperience { get; set; }

        [Display(Name = "学术任职")]
        public string Joinerexperience { get; set; }

        [Display(Name = "资格证书")]
        public string Qualification { get; set; }

        [Display(Name = "会诊费")]
        public double Billing { get; set; }

        [Display(Name = "面诊费")]
        public double FaceBilling { get; set; }

        [Display(Name = "领域")]
        public string Field { get; set; }

        [Display(Name = "咨询时数")]
        public int? ConsultHours { get; set; }

        [Display(Name = "从业年限")]
        public int? WorkYears { get; set; }

        [Display(Name = "省")]
        public string Province { get; set; }

        [Display(Name = "城市")]
        public string City { get; set; }

        [Display(Name = "县区")]
        public string Area { get; set; }
        
        [Display(Name = "擅长人群")]
        public string TargetGroup { get; set; }

        [Display(Name = "咨询方式")]
        public string Mode { get; set; }        

        [Display(Name = "所教课程")]
        public string Course { get; set; }

        [Display(Name = "昵称")]
        [StringLength(100)]
        public string nickName { get; set; }
        
        [Display(Name = "微信关注微信")]
        public short? isWeChat { get; set; }//0、未关注  1、已关注

        [Display(Name = "备注")]
        public string remark { get; set; }

        [Display(Name = "后台备注")]
        public string backgroundRemark { get; set; }               

        [Display(Name = "备用字段")]
        public string Backup { get; set; }

        [Display(Name = "是否删除")]
        public bool isDelete { get; set; }

        [Display(Name = "添加时间")]
        public DateTime createTime { get; set; }

        [Display(Name = "修改时间")]
        public DateTime ModifyTime { get; set; }

        public T_Doctor()
        {
            this.gId = Guid.NewGuid().ToString("N");
            this.createTime = DateTime.Now;
            this.ModifyTime = this.createTime;
            this.isDelete = false;
            this.sex = "男";          
            this.isWeChat = 0;
            this.age = 0;
            this.SourceID = 0;
            this.Billing=0;
            this.FaceBilling = 0;
            this.ConsultHours = 0;
            this.WorkYears = 0;
            this.UserName = "";
            this.Password = "";
        }
        public T_Doctor( string openid,string name, string hospitalName, string departmentName,string position, string tel, string email , string sex="男", int age=30)
        {
            this.gId = Guid.NewGuid().ToString("N");
            this.createTime = DateTime.Now;
            this.ModifyTime = this.createTime;
            this.isDelete = false;
            this.sex = sex;
            this.openid = openid;
            this.hospitalName = hospitalName;
            this.departmentName = departmentName;
            this.position = position ;
            this.tel = tel;
            this.email = email;
            this.name = name;
            this.age = age;
            this.isWeChat = 0;
            this.SourceID = 0;
            this.Billing = 0;
            this.FaceBilling = 0;
            this.ConsultHours = 0;
            this.WorkYears = 0;
            this.UserName = "";
            this.Password = "";
        }
    }
}