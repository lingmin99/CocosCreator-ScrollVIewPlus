const { ccclass, property } = cc._decorator;

/**
 * @classdesc 只渲染可视区域的ScrollView
 * @author caizhitao
 * @version 0.1.0
 * @since 2019-07-12
 * @description
 *
 * 用法：
 *
 *      1. 将本组件挂载在节点上即可，和正常ScrollView使用一致
 *
 * 原理：
 *
 *      1. 滚动时，判断子节点是否进入了/离开了可视区域
 *      2. 根据结果回调对应事件，在可以实现类似以下功能：
 *          * 控制可视区域Item显示（透明度改为 255 ），非可视区域Item隐藏（透明度改为 0 ）
 */
@ccclass
export default class FabGridView extends cc.ScrollView {
    @property({
        tooltip: "是否计算在可视区域中Item的相对位置（可能会相对耗性能）"
    })
    caculatePosition: boolean = false;

    _dataArray: Array<cc.Node>;
    _itemComponent: string;
    _enterVisibleScrollView: Function;
    _exitVisibleScrollView:  Function;

    _visibleViewMinIndex = 0;
    _visibleViewMaxIndex = 0;
    _lastOffset = new cc.Vec2(0, 0);

    onEnable() {
        super.onEnable();
        this.node.on("scrolling", this._onScrollingDrawCallOpt, this);
    }

    onDisable() {
        super.onDisable();
        this.node.off("scrolling", this._onScrollingDrawCallOpt, this);
    }

    private _onScrollingDrawCallOpt() {
       
        this.optDc();
    }

    public initData(dataArray: Array<cc.Node>, itemComponent: string, enterVisibleScrollView: Function, exitVisibleScrollView: Function){
        this._dataArray = dataArray;
        this._itemComponent = itemComponent;
        this._enterVisibleScrollView = enterVisibleScrollView;
        this._exitVisibleScrollView = exitVisibleScrollView;
        this.content.removeAllChildren();
        this._visibleViewMinIndex = 0;
        this._visibleViewMaxIndex = this._dataArray.length;
        this.scrollToTopLeft(0.5);
        

        dataArray.forEach((childNode: cc.Node) =>{
            this.content.addChild(childNode);
        });

        this.optDc();

    }

    /**
     * 优化 ScrollView Content 节点 DC，可以手动调用
     *
     * 具体为
     *
     * 1. 进入ScrollView可视区域是，回调对应 Content 子节点上挂载的 ScollViewPlusItem 组件的 onEnterScorllViewEvents 数组事件
     * 2. 退出ScrollView可视区域是，回调对应 Content 子节点上挂载的 ScollViewPlusItem 组件的 onExitScorllViewEvents 数组事件
     */
    public optDc() {
        if (this.content.childrenCount == 0) {
            return;
        }
        var isLoadMore = true;
        var curOffset = this.getScrollOffset();
        if(curOffset.x > this._lastOffset.x){ //向右滚动加载左边内容
            isLoadMore = false;
        }else if(curOffset.y < this._lastOffset.y){//向下滚动加载上面面更多
            isLoadMore = false;
        }
        // 获取 ScrollView Node 的左下角坐标在世界坐标系中的坐标
        let svLeftBottomPoint: cc.Vec2 = this.node.parent.convertToWorldSpaceAR(
            cc.v2(
                this.node.x - this.node.anchorX * this.node.width,
                this.node.y - this.node.anchorY * this.node.height
            )
        );

        // 求出 ScrollView 可视区域在世界坐标系中的矩形（碰撞盒）
        let svBBoxRect: cc.Rect = cc.rect(svLeftBottomPoint.x, svLeftBottomPoint.y, this.node.width, this.node.height);

        // 遍历 ScrollView Content 内容节点的子节点，对每个子节点的包围盒做和 ScrollView 可视区域包围盒做碰撞判断
        var index = 0;
        var children = this.content.children;
    
        if(isLoadMore){ //向右或下加载更多
            var firstVisibleIndex = -1;
            var minIndex = this._visibleViewMinIndex;
            for(var index = minIndex; index < children.length; index++){
                var childNode = children[index];
                var isVisible = this.checkItemVisible(svBBoxRect, childNode, index);
               if(isVisible && firstVisibleIndex == -1){
                   this._visibleViewMinIndex = index;
                   firstVisibleIndex = index;
               } 
               if(isVisible){ // 可见item最后的index
                   this._visibleViewMaxIndex = index;
               }else if(firstVisibleIndex != -1){//如果有出现过第一个item，后面只要有出现不可见就认为可见区域item加载完停止继续遍历
                   break;
               }
            }
        }else{ //向上或向左加载
            var firstVisibleIndex = -1;
            for(var index = this._visibleViewMaxIndex; index >= 0; index--){
                var childNode = children[index];
                var isVisible = this.checkItemVisible(svBBoxRect, childNode, index);
               if(isVisible && firstVisibleIndex == -1){
                   this._visibleViewMaxIndex = index;
                   firstVisibleIndex = index;
               } 
               if(isVisible){ // 可见item最小的index
                   this._visibleViewMinIndex = index;
               }else if(firstVisibleIndex != -1){//如果有出现过第一个item，后面只要有出现不可见就认为可见区域item加载完停止继续遍历
                   break;
               }
            }
        }
        this._lastOffset = curOffset;
    }

    private checkItemVisible(svBBoxRect: cc.Rect, childNode: cc.Node, index: Number){
        if(!childNode){
            cc.log("childNode 没定义");
            return;
        }
      // 没有绑定指定组件的子节点不处理
        let itemComponent = childNode.getComponent(this._itemComponent);
        if (itemComponent == null) {
            return false;
        }

        // 如果相交了，那么就显示，否则就隐藏
        let childNodeBBox = childNode.getBoundingBoxToWorld();
        if (childNodeBBox.intersects(svBBoxRect)) {
            if(this._enterVisibleScrollView){
                this._enterVisibleScrollView(index, childNode, itemComponent);
            }
            return true;
        } else {
            if(this._exitVisibleScrollView){
                this._exitVisibleScrollView(index, childNode, itemComponent);
            }
            return false;
        }
    }
}
