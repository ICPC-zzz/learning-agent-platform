import { describe, it } from "node:test";
import assert from "node:assert/strict";

var DC = ["Python","JavaScript","Algorithm","Data Structures","Database","Web Dev","Machine Learning","System Design"];

function filterBooks(books,input) {
  var q=(input.searchQuery||"").trim().toLowerCase();
  var cat=(input.categoryFilter||"").trim().toLowerCase();
  var active=q.length>0||cat.length>0;
  if(!active) return {books:[...books],hasActiveFilters:false,totalBefore:books.length,totalAfter:books.length};
  var filtered=books.filter(function(book){
    var mt=q.length===0;
    if(!mt){var fields=[book.title||"",book.summary||"",book.description||"",book.author||"",book.category||"",(book.tags||[]).join(" ")];for(var i=0;i<fields.length;i++){if(fields[i].trim().toLowerCase().indexOf(q)>=0){mt=true;break;}}}
    var bc=(book.category||"").trim().toLowerCase();
    var mc=cat.length===0||bc===cat;
    if(!mc&&cat==="other"){mc=true;for(var j=0;j<DC.length;j++){if(bc===DC[j].toLowerCase()){mc=false;break;}}}
    return mt&&mc;
  });
  return {books:filtered,hasActiveFilters:true,totalBefore:books.length,totalAfter:filtered.length};
}

function resolveBookCategory(tags,metadata,importedCat){
  if(importedCat&&importedCat.trim().length>0)return importedCat.trim();
  if(metadata&&typeof metadata==="object"&&!Array.isArray(metadata)){
    if(typeof metadata.category==="string"&&metadata.category.trim().length>0)return metadata.category.trim();
    if(typeof metadata.importCategory==="string"&&metadata.importCategory.trim().length>0)return metadata.importCategory.trim();
  }
  if(tags&&tags.length>0){for(var i=0;i<tags.length;i++){for(var j=0;j<DC.length;j++){if(tags[i].trim().toLowerCase()===DC[j].toLowerCase())return DC[j];}}}
  return "Other";
}

function collectCategories(books){
  var s=new Set();
  for(var i=0;i<books.length;i++){var c=(books[i].category||"").trim();s.add(c.length>0?c:"Other");}
  return Array.from(s).sort();
}

function mk(ov){return{id:"b"+Math.random().toString(36).slice(2,6),title:"T",author:"A",description:"D",category:"Python",tags:["Python"],sourceType:"x",sourceLabel:"x",detailHref:"/a",readerHref:"/b",...ov};}

var books=[
  mk({id:"b1",title:"Python Programming",author:"Alice",description:"Learn Python",category:"Python",tags:["Python"]}),
  mk({id:"b2",title:"JavaScript Async",author:"Bob",description:"Deep JS async",category:"JavaScript",tags:["JavaScript"]}),
  mk({id:"b3",title:"Algorithms 101",author:"Charlie",description:"Sort and search",category:"Algorithm",tags:["Algorithm"]}),
  mk({id:"b4",title:"Database Systems",author:"Diana",description:"Relational DB",category:"Database",tags:["Database"]}),
  mk({id:"b5",title:"Web Fullstack",author:"Eve",description:"React+Node",category:"Web Dev",tags:["React"]}),
  mk({id:"b6",title:"ML Basics",author:"Frank",description:"sklearn intro",category:"Machine Learning",tags:["ML"]}),
  mk({id:"b7",title:"System Design 101",author:"Grace",description:"Distributed",category:"System Design",tags:["Distributed"]}),
  mk({id:"b8",title:"Data Structures",author:"Hank",description:"Lists trees",category:"Data Structures",tags:["DS"]}),
  mk({id:"b9",title:"C++ Primer",author:"Ivy",description:"Classic C++",category:"Other",tags:["C++"]}),
  mk({id:"b10",title:"Untagged Book",author:"Jack",description:"No category",category:"Other",tags:[]}),
];

describe("A472 Search & Category",function(){
  it("finds by exact title",function(){var r=filterBooks(books,{searchQuery:"Algorithms 101"});assert.equal(r.books.length,1);assert.equal(r.books[0].id,"b3");});
  it("finds by partial title case-insensitive",function(){var r=filterBooks(books,{searchQuery:"python"});assert.equal(r.books.length,1);assert.equal(r.books[0].id,"b1");});
  it("finds by author",function(){var r=filterBooks(books,{searchQuery:"Charlie"});assert.equal(r.books.length,1);});
  it("finds by description keyword",function(){var r=filterBooks(books,{searchQuery:"sklearn"});assert.equal(r.books.length,1);});
  it("filters by category Python",function(){var r=filterBooks(books,{categoryFilter:"Python"});assert.equal(r.books.length,1);assert.equal(r.books[0].id,"b1");});
  it("filters by category Other",function(){var r=filterBooks(books,{categoryFilter:"Other"});assert.equal(r.books.length,2);assert.equal(r.books[0].id,"b9");});
  it("combined search and category",function(){var r=filterBooks(books,{searchQuery:"Lists",categoryFilter:"Data Structures"});assert.equal(r.books.length,1);});
  it("empty result for non-match",function(){var r=filterBooks(books,{categoryFilter:"QuantumComputing"});assert.equal(r.books.length,0);});
  it("no filters returns all 10 books",function(){var r=filterBooks(books,{});assert.equal(r.hasActiveFilters,false);assert.equal(r.books.length,10);});
  it("resolveBookCategory uses imported category",function(){assert.equal(resolveBookCategory(["Go"],null,"Python"),"Python");});
  it("resolveBookCategory infers from tags",function(){assert.equal(resolveBookCategory(["Python"],null),"Python");});
  it("resolveBookCategory infers from metadata.category",function(){assert.equal(resolveBookCategory(["x"],{category:"Algorithm"}),"Algorithm");});
  it("resolveBookCategory infers from importCategory",function(){assert.equal(resolveBookCategory([],{importCategory:"Database"}),"Database");});
  it("resolveBookCategory returns Other for unknown",function(){assert.equal(resolveBookCategory(["Physics"],null),"Other");});
  it("resolveBookCategory empty input returns Other",function(){assert.equal(resolveBookCategory([],null),"Other");});
  it("collectCategories includes Python and Other",function(){var cats=collectCategories(books);assert.ok(cats.indexOf("Python")>=0);assert.ok(cats.indexOf("Other")>=0);});
});

console.log("A472 search & category tests completed");
