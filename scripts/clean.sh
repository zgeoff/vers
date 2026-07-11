#!/bin/sh

rm -rf .nx
rm -rf dist
rm -rf node_modules
rm -rf tmp

for dir in apps/* services/* contracts/* libs/*/* infra; do
  rm -rf "$dir/.cache"
  rm -rf "$dir"/*.timestamp*.mjs
  rm -rf "$dir/build"
  rm -rf "$dir/dist"
  rm -rf "$dir/node_modules"
done