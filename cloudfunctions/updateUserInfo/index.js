// 云函数入口文件
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// 新增：随机中文名生成函数
function generateChineseName() {
  const surnames = ['赵','钱','唐','孙','李','周','吴','郑','王','冯','陈','褚','卫','蒋','沈','韩','杨','朱','秦','尤','许','何','吕','施','张'];
  const names = ['怀','风','怀远','无痕','静','月娜','虚子','尘平','惊','龙明','霜','雪','娟','涛','超','鸿','霞','平','红尘','明','燕','明','欣','中舒','舒'];
  const surname = surnames[Math.floor(Math.random() * surnames.length)];
  const name1 = names[Math.floor(Math.random() * names.length)];
  // const name2 = names[Math.floor(Math.random() * names.length)];
  return surname + name1 
}

// 云函数入口函数
exports.main = async (event, context) => {
  const db = cloud.database()
  const { openid, userInfo, lastLoginTime, loginOnly, cardColor } = event

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
        const updateData = {
          userInfo: {
            ...res.data[0].userInfo,  // 保留原有userInfo
            ...userInfo,  // 合并新的userInfo
            attempts: userInfo.attempts || res.data[0].userInfo?.attempts || 0,  // 确保attempts字段存在
            score: userInfo.score || res.data[0].userInfo?.score || 0  // 确保score字段存在
          },
          lastLoginTime: lastLoginTime
        };
        
        // 如果提供了卡片颜色，则更新颜色
        if (cardColor) {
          updateData.cardColor = cardColor;
        }
        
        await db.collection('users').doc(res.data[0]._id).update({
          data: updateData
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
      const initialUserInfo = {
        ...userInfo,
        nickName: userInfo?.nickName || randomNick,
        avatarUrl: userInfo?.avatarUrl || '', // 默认头像可以在前端设置
        attempts: userInfo?.attempts || 0,  // 初始化打卡次数
        score: userInfo?.score || 0  // 初始化分数
      };
      
      // 创建新用户记录
      const userResult = await db.collection('users').add({
        data: {
          _openid: openid,
          userInfo: initialUserInfo,
          registerTime: lastLoginTime,
          lastLoginTime: lastLoginTime,
          cardColor: cardColor || ' ' // 默认白色
        }
      });

      // 自动加入指定房间
      try {
        const roomResult = await db.collection('room').where({
          code: '3C5YJC'
        }).get();

        if (roomResult.data.length > 0) {
          const room = roomResult.data[0];
          await db.collection('room').doc(room._id).update({
            data: {
              users: db.command.push({
                openid: openid,
                userName: initialUserInfo.nickName,
                avatarUrl: initialUserInfo.avatarUrl,
                isOwner: false
              })
            }
          });
        }
      } catch (roomErr) {
        console.error('自动加入房间失败:', roomErr);
        // 即使加入房间失败，也不影响用户创建
      }
      
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
