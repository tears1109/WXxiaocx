// 云函数入口文件
const cloud = require('wx-server-sdk')
cloud.init()

// 新增：随机中文名生成函数
function generateChineseName() {
  const surnames = ['赵','钱','孙','李','周','吴','郑','王','冯','陈','褚','卫','蒋','沈','韩','杨','朱','秦','尤','许','何','吕','施','张'];
  const names = ['伟','芳','娜','敏','静','丽','强','磊','洋','勇','俊','杰','娟','涛','超','秀英','霞','平','刚','桂','燕','明','欣','浩','舒'];
  const surname = surnames[Math.floor(Math.random() * surnames.length)];
  const name1 = names[Math.floor(Math.random() * names.length)];
  const name2 = names[Math.floor(Math.random() * names.length)];
  return surname + name1 + name2;
}

// 云函数入口函数
exports.main = async (event, context) => {
  const db = cloud.database()
  const { openid, userInfo, lastLoginTime, loginOnly } = event

  try {
    const res = await db.collection('users').where({
      _openid: openid
    }).get()

    if (res.data.length > 0) {
      // 已存在用户
      if (loginOnly) {
        // 如果是登录操作，只更新登录时间
        await db.collection('users').doc(res.data[0]._id).update({
          data: {
            lastLoginTime: lastLoginTime
          }
        })
      } else {
        // 如果是更新资料操作，更新用户信息和登录时间
        await db.collection('users').doc(res.data[0]._id).update({
          data: {
            userInfo: userInfo,
            lastLoginTime: lastLoginTime
          }
        })
      }
      
      return { 
        success: true,
        isNewUser: false
      }
    } else {
      // 新用户，随机生成中文名并存储信息
      // 即使是只登录，也需要创建新用户记录
      const randomNick = generateChineseName();
      
      // 构建初始用户信息
      const initialUserInfo = userInfo || {
        nickName: randomNick,
        avatarUrl: '' // 默认头像可以在前端设置
      };
      
      // 如果传入的用户信息没有昵称，使用随机生成的
      if (userInfo && !userInfo.nickName) {
        initialUserInfo.nickName = randomNick;
      }
      
      await db.collection('users').add({
        data: {
          _openid: openid,
          userInfo: initialUserInfo,
          registerTime: lastLoginTime,
          lastLoginTime: lastLoginTime
        }
      })
      
      return { 
        success: true,
        isNewUser: true,
        userInfo: initialUserInfo
      }
    }
  } catch (err) {
    console.error(err)
    return { success: false, error: err }
  }
}
