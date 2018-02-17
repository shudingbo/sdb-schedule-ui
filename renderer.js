
const redis = require('ioredis');
const moment = require('moment')
const configuration = require('./configuration.js');
const CornParser = require('cron-parser');

module.exports = function(){
    return new sdbControl();
};

let g_cfg = {
	redis:{ host:'127.0.0.1',port:6379 },
    opt:{keyPre:'sdb:schedule'}
};


let sdbControl = function(){
    this.redis = null;
    this.keyChk = g_cfg.opt.keyPre + ":updateTime";
	this.keyJobs = g_cfg.opt.keyPre + ":jobs";
	this.keyStatus = g_cfg.opt.keyPre + ":status";
	this.keyCfgs = g_cfg.opt.keyPre + ":cfg";
}


sdbControl.prototype.start = function( ){
    let cfg = configuration.readSettings('cfg');

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
    let self = this;
	self.redis.hgetall( self.keyJobs,function( err, jobs){
        let ret = {status:false};
        if( err === null && jobs !== null ){
            self.redis.hgetall( self.keyStatus,function( errSta, status){
                if( errSta === null && status !== null ){
                    ret.status = true;
                    let jobArr = {};
                    for( sc in jobs ){
                        jobArr[ sc ] = JSON.parse(jobs[sc]);
                    }

                    for( sta in status ){
                        let st = JSON.parse(status[sta]);
                        if(  jobArr[sta] !== undefined )
                        {
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
                            
                            if( st.nextRunTime != 0 && st.nextRunTime !== undefined ){
                                st.nxRunTime = moment(new Date(st.nextRunTime*1000)).format('YYYY-MM-DD HH:mm:ss');
                            }else{
                                st.nxRunTime = '';
                            }

                            for( tmp in st){
                                jobArr[sta][tmp] = st[tmp];
                            }
                        }else{
                            if( st['parent'] !== undefined ){
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
                                
                                if( st.nextRunTime != 0 && st.nextRunTime !== undefined ){
                                    st.nxRunTime = moment(new Date(st.nextRunTime*1000)).format('YYYY-MM-DD HH:mm:ss');
                                }else{
                                    st.nxRunTime = '';
                                }

                                //
                                let jobTName = st['parent'] + '-' + sta;
                                jobArr[ jobTName ] = {};
                                for( tmp in st){
                                    jobArr[jobTName][tmp] = st[tmp];
                                }

                            }
                        }
                    }


                    /// sort
                    let jobNamesT = [];
                    for( let tJob in jobArr ){
                        jobNamesT.push(tJob);
                    }
                    jobNamesT.sort();

                    ret.jobs = {};
                    for( let tJob in jobNamesT ){
                        ret.jobs[ jobNamesT[tJob] ] = jobArr[ jobNamesT[tJob] ];
                    }
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
    let self = this;

    self.redis.hget( self.keyStatus, jobname,function( err,reply){
        
        let ret = { status: false};
        if( err === null && reply !== null ){
            
            let jobSta = JSON.parse(reply);
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
    let self = this;
    let ret = { status: false,msg: jobname + ' add faiule'};

    let retChk = checkCornString( cfg.cron );
    if( retChk.status === false  ){
        ret.msg += retChk.msg;
        if( cb ){ cb( ret );}
        return;
    }

    self.redis.hset( self.keyJobs, jobname, JSON.stringify(cfg),
    function( err,reply){
        
        if( err === null && reply !== null ){
            ret.status = true;
            ret.msg = jobname + " add success:<p>" +  retChk.msg;
        }

        if( ret.status === true ){
            self.updateTime(jobname);
        }
            
        if( cb ){ cb( ret );}

    });
};

sdbControl.prototype.update_job = function( jobname, cfg,cb )
{
    let self = this;
    let ret = { status: false,msg: jobname + ' update faiule '};

    let retChk = checkCornString( cfg.cron );
    if( retChk.status === false  ){
        ret.msg += retChk.msg;
        if( cb ){ cb( ret );}
        return;
    }

    self.redis.hset( self.keyJobs, jobname, JSON.stringify(cfg),
    function( err,reply){
        if( err === null && reply !== null ){
            ret.status = true;
            ret.msg = jobname + " update success <p>" + retChk.msg;
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
    let self = this;
    self.redis.hget( self.keyCfgs, jobName, function(err, reply){
        let ret = { status: true,cfg:"{}"};
        if( err === null && reply !== null ){
            console.log(reply);
            ret.cfg = reply;
        }

        if( cb ){ cb( ret );}
    });
};

sdbControl.prototype.set_job_cfg = function(jobName, cfg, cb){
    let self = this;
    self.redis.hset( self.keyCfgs, jobName, cfg, function(err,reply){
        let ret = { status: false,msg: jobName + ' config update failure'};
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
	self.redis = new redis( g_cfg.redis );
	self.redis.on("error",function( err ){
		console.log("Error " + err);
	});

	self.redis.on("connect",function( err ){
		console.log("-- Connect to redis.");
    });
    
    self.redis.on("close",function( err ){
		console.log("-- redis has close.");
    });

    self.redis.on("reconnecting",function( err ){
		console.log("-- reconnecting to redis.");
    });

}

function disconnectRedis( self ){
	self.redis.quit();
	console.log("-- DisConnect from redis.");
}


function checkCornString( szCron )
{
    let ret = {"status":false, "msg":""};
    try {
        let interval = CornParser.parseExpression(szCron);
        ret.status = true;
        ret.msg = 'Next Run at: ' + interval.next().toString();
    } catch (err) {
        ret.msg = 'Error: ' + err.message;
    }

    return ret;
}




