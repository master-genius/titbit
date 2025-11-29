'use strict';

/**
    module connfilter
    Copyright (C) 2019.08 BraveWang
 */
/**
 * 请求过滤模块，此模块要挂载到connection事件上。
 * @param {object} options 选项值参考：
 * - unitTime  {number}
 * - maxConn   {number}
 * - deny      {array}
 * - allow     {array}
 * rundata是运行时数据，这个数据需要实时更新到负载监控，所以可以通过传递一个对象指向全局应用。
 * 
 */

let connfilter = function (limit, rundata) {

  if (! (this instanceof connfilter)) {
      return new connfilter(limit, rundata);
  }

  let the = this;

  this.iptable = new Map();

  /**
   * 请求过滤函数。
   * @param {object} sock 当前请求的socket实例。
   */
  this.callback = (sock) => {
    rundata.conn++;
    sock.on('close', (e) => {
      rundata.conn--;
    });
    
    let remote_ip = sock.remoteAddress;
    /**
     * 注意，这需要你指明所运行的模式是IPv4,也就是要指明host为'0.0.0.0'或是其他，
     * 否则会默认使用IPv6的地址，这时候，remoteAddress显示::ffff:127.0.0.1这样的字符串。
     * */
    if (limit.deny) {
      if ( (limit.deny_type === 's' && limit.deny.has(remote_ip)) 
          || (limit.deny_type === 'f' && limit.deny(remote_ip)) )
      {
        sock.destroy();
        return false;
      }
    }

    //检测是否超过最大连接数限制。
    if (limit.maxConn > 0 && rundata.conn > limit.maxConn) {
      sock.destroy();
      return false;
    }

    //如果开启了单元时间内单个IP最大访问次数限制则检测是否合法。
    let ipcount;

    if (limit.maxIPRequest > 0 && 
        !( (limit.allow_type === 's' && limit.allow && limit.allow.has(remote_ip)) 
          || (limit.allow_type === 'f' && limit.allow(remote_ip)) ) )
    {
      let tm = Date.now();

      if (the.iptable.has(remote_ip)) {

        ipcount = this.iptable.get(remote_ip);

        if (tm - ipcount.time > limit.unitTime) {
          ipcount.count = 1;
          ipcount.time = tm;
          this.iptable.delete(remote_ip);
          this.iptable.set(remote_ip, ipcount);
        } else {
          if (ipcount.count >= limit.maxIPRequest) {
            sock.destroy();
            return false;
          } else {
            ipcount.count++;
          }
        }
        
      } else if (the.iptable.size >= limit.maxIPCache) {
        /** 
         * 如果已经超过IP最大缓存数量限制则关闭连接，这种情况在极端情况下会出现。
         * 不过最大缓存数量不能低于最大连接数。否则并发支持会受限制。
         * */
        sock.destroy();
        return false;

      } else {
        the.iptable.set(remote_ip, {count: 1, time: tm});
      }
    }

    return true;
  };

  this.intervalId = null;

  /**
   * 限制IP请求次数的定时器。
   * 这意味着会定期进行一次大清空。
   */
  if (limit.maxIPRequest > 0) {
    this.intervalId = setInterval(() => {
      if (the.iptable.size >= limit.maxIPCache) {
        the.iptable.clear();
      } else {
        let tm = Date.now();

        for (let [k, v] of the.iptable) {
          if ( (tm - v.time - 5000) < limit.unitTime) break;
          the.iptable.delete(k);
        }
      }

    }, limit.unitTime + 5000);
  }

}

module.exports = connfilter;
