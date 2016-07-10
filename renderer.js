

var redis = require('redis');
var moment = require('moment')
var configuration = require('./configuration.js');

module.exports = function(){
    return new sdbControl();
};

var g_cfg = {
	redis:{ host:'127.0.0.1',port:6379 },
    opt:{keyPre:'sdb:schedule'}
};


var sdbControl = function(){
    this.redis = null;
    this.keyChk = g_cfg.opt.keyPre + ":updateTime";
	this.keyJobs = g_cfg.opt.keyPre + ":jobs";
	this.keyStatus = g_cfg.opt.keyPre + ":status";
	this.keyCfgs = g_cfg.opt.keyPre + ":cfg";
}


sdbControl.prototype.start = function( ){
    var cfg = configuration.readSettings('cfg');

    if (!cfg) {
        configuration.saveSettings('cfg', g_cfg);
    }else{
        g_cfg = cfg;
    }

    connectRedis( this );
};


sdbControl.prototype.updateTime = function( jobName ){
    this.redis.hset( this.keyChk, jobName,parseInt((new Date()).valueOf()/1000 ));
};


sdbControl.prototype.get_jobs = function( cb )
{
    var self = this;
	self.redis.hgetall( self.keyJobs,function( err, jobs){
        var ret = {status:false};
        if( err === null && jobs !== null ){
            self.redis.hgetall( self.keyStatus,function( errSta, status){
                if( errSta === null && status !== null ){
                    ret.status = true;
                    var jobArr = {};
                    for( sc in jobs ){
                        jobArr[ sc ] = JSON.parse(jobs[sc]);
                    }

                    for( sta in status ){
                        if(  jobArr[sta] !== undefined )
                        {
                            var st = JSON.parse(status[sta]);
                            if( st.startTime != 0 ){
                                st.startTime = moment(new Date(st.startTime*1000)).format('YYYY-MM-DD HH:mm:ss');
                            }else{
                                st.startTime = '';
                            }

                            if( st.stopTime != 0 ){
                                st.stopTime = moment(new Date(st.stopTime*1000)).format('YYYY-MM-DD HH:mm:ss');
                            }else{
                                st.stopTime = '';
                            }

                            if( st.latestRunTime != 0 ){
                                st.runTime = moment(new Date(st.latestRunTime*1000)).format('YYYY-MM-DD HH:mm:ss');
                            }else{
                                st.runTime = '';
                            }

                            for( tmp in st){
                                jobArr[sta][tmp] = st[tmp];
                            }
                        }
                    }

                    ret.jobs = jobArr;
                    if( cb ){cb( ret );}
                }
            });
		}
        else{
            ret.status = false;
            if( cb ){cb( ret );}
        }
	});
};


sdbControl.prototype.del_job = function( jobname,cb )
{
    var self = this;

    self.redis.hget( self.keyStatus, jobname,function( err,reply){
        
        var ret = { status: false};
        if( err === null && reply !== null ){
            
            var jobSta = JSON.parse(reply);
            if( jobSta.status !== false ){
                ret.msg = jobname + " is running,can't delete. Please Stop first!";
            }else{
                self.redis.hdel( self.keyJobs, jobname );
                self.redis.hdel( self.keyStatus, jobname );
                self.redis.hdel( self.keyCfgs, jobname );
                ret.status = true;
                ret.msg = jobname + " delete success";
            }
        }else{
            self.redis.hdel( self.keyJobs, jobname );
            self.redis.hdel( self.keyStatus, jobname );
            self.redis.hdel( self.keyCfgs, jobname );
            ret.status = true;
            ret.msg = jobname + " delete success";
        }

        if( ret.status === true ){
            self.updateTime(jobname );
        }
            
        if( cb ){ cb( ret );}

    });
};

sdbControl.prototype.add_job = function( jobname, cfg,cb )
{
    var self = this;

    self.redis.hset( self.keyJobs, jobname, JSON.stringify(cfg),
    function( err,reply){
        var ret = { status: false,msg: jobname + ' add faiule'};
        if( err === null && reply !== null ){
            ret.status = true;
            ret.msg = jobname + " add success";
        }

        if( ret.status === true ){
            self.updateTime(jobname);
        }
            
        if( cb ){ cb( ret );}

    });
};

sdbControl.prototype.update_job = function( jobname, cfg,cb )
{
    var self = this;

    self.redis.hset( self.keyJobs, jobname, JSON.stringify(cfg),
    function( err,reply){
        var ret = { status: false,msg: jobname + ' add faiule'};
        if( err === null && reply !== null ){
            ret.status = true;
            ret.msg = jobname + " add success";
        }
            
        if( ret.status === true ){
            self.updateTime( jobname);
        }

        if( cb ){ cb( ret );}

    });
};


sdbControl.prototype.save_cfg = function( cfg )
{
    g_cfg = cfg;
    configuration.saveSettings('cfg', g_cfg);
}


sdbControl.prototype.get_cfg = function(  )
{
    return g_cfg;
}

sdbControl.prototype.get_job_cfg = function( jobName, cb){
    var self = this;
    self.redis.hget( self.keyCfgs, jobName, function(err, reply){
        var ret = { status: true,cfg:"{}"};
        if( err === null && reply !== null ){
            console.log(reply);
            ret.cfg = reply;
        }

        if( cb ){ cb( ret );}
    });
};

sdbControl.prototype.set_job_cfg = function(jobName, cfg, cb){
    var self = this;
    self.redis.hset( self.keyCfgs, jobName, cfg, function(err,reply){
        var ret = { status: false,msg: jobName + ' config update failure'};
        if( err === null && reply !== null ){
            ret.status = true;
            ret.msg = jobName + " config update success";
        }
            
        if( ret.status === true ){
            self.updateTime( jobName);
        }

        if( cb ){ cb( ret );}
    });
}



function connectRedis( self ){
	self.redis = redis.createClient( g_cfg.redis );
	self.redis.on("error",function( err ){
		console.log("Error " + err);
	});

	self.redis.on("connect",function( err ){
		console.log("-- Connect to redis.");
	});
}

function disconnectRedis( self ){
	self.redis.quit();
	console.log("-- DisConnect from redis.");
}





