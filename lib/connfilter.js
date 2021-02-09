/**
    module connfilter
    Copyright (C) 2019.08 BraveWang
    This program is free software; you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation; either version 3 of the License , or
    (at your option) any later version.
 */

'use strict';

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

/**
 *
 * 在定时器间隔的边界条件，可以让限制突破两倍的限制。所以目前的策略存在问题。
 *
 * 更好的方式是通过记录完整的信息完成精确的限制。
 *
 * */

var connfilter = function (limit, rundata) {

  if (! (this instanceof connfilter)) {
      return new connfilter(limit, rundata);
  }

  let the = this;

  this.iptable = new Map();

  this.clearLoopCount = 1000;

  /**
   * 请求过滤函数。
   * @param {object} sock 当前请求的socket实例。
   */
  this.callback = (sock) => {

    rundata.conn += 1;

    sock.on('close', (e) => {
      rundata.conn -= 1;
    });

     //检测是否在拒绝IP列表中。
    /*
     * 注意，这需要你指明所运行的模式是IPv4,也就是要指明host为'0.0.0.0'或是其他，
     * 否则会默认使用IPv6的地址，这时候，remoteAddress显示::ffff:127.0.0.1这样的字符串。
     * */
    if (limit.deny.length > 0 && limit.deny.indexOf(sock.remoteAddress)>=0)
    {
      sock.destroy();
      return false;
    }

    //检测是否超过最大连接数限制。
    if (limit.maxConn > 0 && rundata.conn > limit.maxConn)
    {
      sock.destroy();
      return false;
    }

    //如果开启了单元时间内单个IP最大访问次数限制则检测是否合法。
    let remote_ip = sock.remoteAddress;
    let ipcount;

    if (limit.maxIPRequest > 0 && limit.allow.indexOf(remote_ip) < 0) {

      let tm = Date.now();

      if (the.iptable.has(remote_ip)) {

        ipcount = this.iptable.get(remote_ip);

        if (tm - ipcount.time > limit.unitTime) {
          ipcount.count = 1;
          ipcount.time = tm;
        } else {
          if (ipcount.count >= limit.maxIPRequest) {
            sock.destroy();
            return false;
          } else {
            ipcount.count += 1;
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
        the.iptable.set(remote_ip, {
          count: 1,
          time: tm
        });
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

      } else if (the.iptable.size >= the.clearLoopCount) {

        let count = 0;

        for (let [k, v] of the.iptable) {
          count += 1;
          
          the.iptable.delete(k);

          if (count >= the.iptable.clearLoopCount) {
            break;
          }

        }

      } else {
        let tm = Date.now();

        for (let [k, v] of the.iptable) {
          if ( (tm - v.time - 5000) > limit.unitTime) {
            the.iptable.delete(k);
          }
        }
      }

    }, limit.unitTime + 5000);
  }

};

module.exports = connfilter;

