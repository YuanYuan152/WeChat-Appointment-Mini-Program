using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Text;
using System.Web.Mvc;

namespace lxxl.Models
{
    //用户表
    public class T_User
    {
        [Key]
        [HiddenInput(DisplayValue = false)]
        public long ID { get; set; }

        [Display(Name = "逻辑Id")]
        [StringLength(32)]
        public string gId { get; set; }

        [Required]
        [Display(Name = "用户类型")]
        [StringLength(10)]
        public string type { get; set; }

        [Required]
        [Display(Name = "用户名")]//即注册手机号
        public string UserName { get; set; }

        [Required]
        [Display(Name = "密码")]

        [DataType(DataType.Password)]
        [StringLength(100, ErrorMessage = "密码最小为6位.", MinimumLength = 6)]
        public string PassWord { get; set; }

        [Required]
        [Display(Name = "姓名")]
        public string Name { get; set; }

        [Display(Name = "性别")]
        public string Sex { get; set; }

        [Display(Name = "年龄")]
        public int Age { get; set; }

        [Display(Name = "邮箱")]
        public string Mail { get; set; }

        [Display(Name = "电话")]
        public string Tel { get; set; }

        //外键关联
        [Display(Name = "推荐医生")]
        [ForeignKey("DoctorID")]
        public T_Doctor Doctor { get; set; }

        public long? DoctorID { get; set; }
        
        [Display(Name = "微信OpenID")]
        public string OpenID { get; set; }

        [Display(Name = "微信unionid")]
        public string unionid { get; set; }

        [Display(Name = "头像路径")]
        public string TopUrl { get; set; }

        [Display(Name = "昵称")]
        public string nickname { get; set; }
        
        [Display(Name = "状态")]
        public int Status { get; set; }

        [Display(Name = "是否删除")]
        public bool IsDelete { get; set; }

        [Display(Name = "添加时间")]
        public DateTime CreateTime { get; set; }
        
        [Display(Name = "更新时间")]
        public DateTime ModifyTime { get; set; }

        [Display(Name = "备注")]
        public string Remark { get; set; }

        [Display(Name = "微信确认好友")]
        public short? WeChat { get; set; }//0、未确认  1、没有微信 2、已加好友 3、未加好友

        [Display(Name = "微信关注微信")]
        public short? IsWeChat { get; set; }//0、未关注  1、已关注

        [Display(Name = "余额")]
        public double Score { get; set; }

        [Display(Name = "提现卡号")]
        public string Card { get; set; }

        [Display(Name = "提现卡主姓名")]
        public string CardName { get; set; }

        [Display(Name = "开户银行")]
        public string CardBank { get; set; }

        [Display(Name = "开户地")]
        public string CardAdress { get; set; }

        [Display(Name = "储蓄余额")]
        public double? Balance { get; set; }//用户余额=储蓄余额+积分(积分优先扣除)积分可提现，储蓄余额不可提现

        [Display(Name = "注册来源类型")]//公众号的ID 
        public long SourceID { get; set; }

        [Display(Name = "体重")]
        public double weight { get; set; }
        [Display(Name = "身高")]
        public double height { get; set; }
        [Display(Name = "血型")]
        public string bloodType { get; set; }
        [Display(Name = "腰围")]
        public double waistCircumference { get; set; }

        [Display(Name = "保险")]
        public string insurance { get; set; }

        [Display(Name = "语言")]
        public string language { get; set; }

        [Display(Name = "国家")]
        public string nationality { get; set; }


        [Display(Name = "备用字段")]
        public string backupR { get; set; }
        
        public T_User()
        {
            this.gId = Guid.NewGuid().ToString("N");
            this.IsDelete = false;
            this.CreateTime = DateTime.Now;
            this.ModifyTime = this.CreateTime;
            this.Status = 0;
            this.IsWeChat = 0;
            this.type = "patient";
            this.IsDelete = false;
            this.Sex = "male";
            this.Score = 0;
            this.WeChat = 0;
            this.IsWeChat = 0;
            this.PassWord = this.CreateTime.ToString("yyyyMMddHHmmssfff");
            this.weight = 0;
            this.height = 0;
            this.bloodType = "";
            this.waistCircumference = 0;
            this.language = "";
            this.insurance = "";
            this.nationality = "";
        }

        public T_User(string username, string password, string name, int age)
        {
            this.gId = Guid.NewGuid().ToString("N");
            this.CreateTime = DateTime.Now;
            this.ModifyTime = this.CreateTime;
            this.Status = 0;
            this.IsDelete = false;
            this.type = "patient";
            this.Sex = "male";
            this.Score = 0;
            this.UserName = username;
            this.PassWord = password;
            this.Name = name;
            this.Age = age;
            this.WeChat = 0;
            this.IsWeChat = 0;
            this.weight = 0;
            this.height = 0;
            this.bloodType = "";
            this.waistCircumference = 0;
        }

        #region 获取推荐医生
        public T_Doctor GetDoctor()
        {
            TMLSContext db = new TMLSContext();
            T_Doctor Doctor = db.T_Doctor.Where(o => o.ID == this.DoctorID && !o.isDelete).FirstOrDefault();
            return Doctor;
        }
        #endregion
    }
}
