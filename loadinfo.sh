#!/bin/bash

PID=
LOAD_FILE="./load-info.log"
RUNCOMM=

get_master_pid () {
    PID=`cat "$LOAD_FILE" | grep 'Master PID' | awk -F ': ' '{printf $2}'`
}

if [ $# -gt 0 ] ; then
    for k in $@ ; do
        case "$k" in
            "--stop")
                RUNCOMM="$k"
                ;;
            *)
                LOAD_FILE="$k"
                ;;
        esac
    done
fi

get_master_pid

CPID=`ps -e -o comm,pid,args | grep "node.*$PID" | grep -v grep`

if [ -n "$RUNCOMM" ] ; then
    case "$RUNCOMM" in
        "--stop")
            if [ -n "$CPID" ] ; then
                kill "$PID" && echo "stop server"
            fi
            exit 0
            ;;
    esac
else
    if [ ! -f $LOAD_FILE ] ; then
        echo "$LOAD_INFO not found"
        echo "usage: $0 [PATH], by default, the file is ./load-info.log"
        exit 1
    fi
fi

if [ -z "$CPID" ] ; then
    echo "The master process not running"
    echo "Please run the server with node"
    exit 1
fi

while cat "$LOAD_FILE" ; do
    echo "run 'kill $PID' to end the server"
    sleep 0.6
    clear
done
