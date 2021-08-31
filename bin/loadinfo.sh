#!/bin/bash

if [ "$#" -eq 0 ] ; then
    echo "usage: $0 [PATH]"
    echo "example: $0 /tmp/loadinfo.log"
    exit 0
fi

if [ ! -f "$1" ] ; then
    echo "$1 is not a file"
    exit 1
fi

while clear ; do
    cat "$1"
    sleep 0.35
done

